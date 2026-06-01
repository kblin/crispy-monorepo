"""The actual API calls"""

import os
import logging
from os import path
import feedparser
from flask import request, jsonify, abort
from werkzeug.utils import secure_filename

from crispy_webapi import app
from crispy_webapi.helpers import create_session, get_session, prepare, scan
from crispy_webapi.error_handlers import BadRequest

from flask import send_from_directory,url_for



@app.route('/api/v1.0/version', methods=['GET'])
def get_version():
    import subprocess
    from crispy_webapi.version import __version__ as api_version
    from crispy_models.version import __version__ as cylib_version
    ret = {
        'webapi': api_version,
        'lib': cylib_version,
        'gitrev': subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).strip().decode(encoding="utf-8"),
    }

    return jsonify(ret)


@app.route('/api/v1.0/seqs/id', methods=['POST'])
def post_sequence_id():
    if not request.json or 'asID' not in request.json:
        raise BadRequest('no antiSMASH ID specified')

    session = create_session(from_id=request.json['asID'])
    session_id = session._session_id

    prepare(session)

    data = dict(uri='/api/v1.0/genome', id=str(session_id))
    return jsonify(data)



#return json to the front-side
@app.route('/api/v1.0/seqs/file', methods=['POST'])
def post_sequence_file():
    if not request.files or 'gbk' not in request.files:
        raise BadRequest('No file provided')

    upload = request.files['gbk']
    if upload is None:
        raise BadRequest('No file found in provided field')

    filename = secure_filename(upload.filename)
    session = create_session(from_file=filename)
    session_id = session._session_id

    save_dir = path.join(app.config['UPLOAD_PATH'], '{}'.format(session_id))

    if not path.exists(save_dir):
        os.mkdir(save_dir)
    upload.save(path.join(save_dir, filename))

    prepare(session)
    data = dict(uri='/api/v1.0/genome', id=str(session_id))
    return jsonify(data)


@app.route('/api/v1.0/genome/<int:session_id>', methods=['GET'])
def get_genome(session_id):
    session = get_session(session_id)
    ret = {
        'state': session.state,
        'genome': session.genome,
        'last_updated': session.last_changed,
    }
    if session.state == 'error':
        ret['error'] = session.error

    return jsonify(ret)


@app.route('/api/v1.0/genome/<int:session_id>/<new_state>', methods=['PUT'])
def reset_session_status(session_id, new_state):
    session = get_session(session_id)

    if session.derived:
        abort(403)

    # Only allow changing state to the identical state, apart from allowing to
    # go back to 'loaded' from 'done'
    if new_state == session.state:
        pass
    elif session.state == 'done' and new_state == 'loaded':
        session.state = new_state
        session.region = {}
    else:
        abort(403)

    ret = {
        'state': session.state
    }

    return jsonify(ret)

#submit from overview.html
@app.route('/api/v1.0/genome/<int:session_id>', methods=['POST'])
def start_scan(session_id):
    session = get_session(session_id)
    if not request.json:
        logging.info("no json")
        raise BadRequest("no JSON data")

    if not 'from' in request.json or not 'to' in request.json:
        logging.info("no coordinates")
        raise BadRequest("missing coordinates")

    if request.json['from'] > request.json['to'] or request.json['from'] < 0:
        logging.info("bad coordinates")
        raise BadRequest("invalid coordinates")

    print(session.best_size)
    if not 'best_size' in request.json:
        request.json['best_size'] = 7
    if request.json['best_size'] != None:
        if not 0 < request.json['best_size'] < 20:
            logging.info("bad CRISPR BEST size")
            raise BadRequest("Invalid CRISPR BEST edit window size")
    if not 'best_offset' in request.json:
        request.json['best_offset'] = 13
    if request.json['best_size'] != None:
        if not 0 <= request.json['best_offset'] < 20:
            logging.info("bad CRISPR BEST offset")
            raise BadRequest("Invalid CRISPR BEST edit window offset")
        if request.json['best_size'] + request.json['best_offset'] > 20:
            logging.info("CRISPR BEST offset and window size too large")
            raise BadRequest("CRISPR BEST offset and window size too large")
    #tell if tnpB
    if request.json['flag'] == True:
        session.if_tnpb = True
    else:
        session.if_tnpb = False


    #tell if Cas3
    # if request.json['cas3_flag'] == True:
    #     session.if_cas3 = True
    # else:
    #     session.if_cas3 = False

    # print("flag_______",request.json['flag'])
    # print('session_if_tnpB',session.if_tnpb)


    if request.json['to'] > int(session.genome['length']):
        logging.info("to coordinate too big: to: {!r}, length: {!r}".format(request.json['to'], session.genome['length']))
        raise BadRequest("coordinates out of range 0 - {!r}".format(session.genome['length']))

    if not session.region:
        logging.info(request.json)
        session.from_coord = request.json['from']
        session.to_coord = request.json['to']
        session.best_size = request.json['best_size']
        session.best_offset = request.json['best_offset']
        if 'full_size' in request.json:
            full_size = int(request.json['full_size'])
            if full_size > 50:
                full_size = 50
            session.full_size = full_size
        # if request.json['flag'] == 'false':
        #     session.pam = "TTGAT"
        session.state = 'scanning'
        scan(session)





    else:
        relative_start = request.json['from']
        relative_end = request.json['to']

        if session.from_coord + relative_end > session.to_coord:
            logging.info('new subreq to coord too large')
            raise BadRequest('new subreq to coord too large')

        new_session = create_session(from_file=session.filename)
        new_session.derived = True
        region = session.region

        if 'name' in request.json:
            region['name'] = request.json['name']
        else:
            region['name'] = ''

        new_orfs = []
        for orf in region['orfs']:
            if orf['start'] < relative_start or orf['end'] > relative_end:
                continue
            orf['start'] -= relative_start
            orf['end'] -= relative_start
            new_orfs.append(orf)
        region['orfs'] = new_orfs

        new_grnas = {}
        for _id, grna in region['grnas'].items():

            if grna['start'] < relative_start or grna['end'] > relative_end:
                continue
            grna['start'] -= relative_start
            grna['end'] -= relative_start
            new_grnas[_id] = grna
            # if request.json['flag'] == 'false':
            #     grna['pam'] = "TTGAT"
        region['grnas'] = new_grnas
        #tell if tnpb 2025/05/23
        if request.json['flag'] == True:
            new_session.if_tnpb = True
        else:
            new_session.if_tnpb = False

        #tell if cas3 2025/05/23
        # if request.json['cas3_flag'] == True:
        #     session.if_cas3 = True
        # else:
        #     session.if_cas3 = False


        new_session.from_coord = session.from_coord + relative_start
        new_session.to_coord = session.from_coord + relative_end
        new_session.region = region
        new_session.state = 'done'
        session_id = new_session._session_id
        new_session.best_size = session.best_size
        new_session.best_offset = session.best_offset
        # if request.json['flag'] == 'false':
        #     new_session.pam = "TTGAT"
        # print(request)


    data = dict(uri='/api/v1.0/crispr', id=str(session_id))
    # print("===========================",session.if_cas3)


    return jsonify(data)

#be used by output.js's Crispr
@app.route('/api/v1.0/crispr/<int:session_id>', methods=['GET'])
def get_criprs(session_id):
    session = get_session(session_id)
    region = session.region

    region['state'] = session.state
    region['from'] = session.from_coord
    region['to'] = session.to_coord
    region['last_updated'] = session.last_changed
    region['derived'] = session.derived
    region['best_size'] = session.best_size
    region['best_offset'] = session.best_offset
    if session.state == 'error':
        region['error'] = session.error

    return jsonify(region)

@app.route('/api/v1.0/crispr/<int:session_id>', methods=['POST'])
def get_crispr_csv(session_id):
    try:
        # 1. Get the request data (keep the original authentication logic)
        if not request.json or 'ids' not in request.json:
            raise BadRequest('Invalid ID field')

        # 2. Obtain parameters (compatible with the original request structure)
        crispri_flag = request.json.get('crispri_flag', False)
        selected_ids = request.json['ids']
        frontend_grna_data = request.json.get('grna_data', {})  # 新增字段

        # 3. Get session data (keep the original logic)
        session = get_session(session_id)
        region = session.region

        # 4. Process the selected gRNA (keep the original logic, only add the merged CRISPRi_score part)
        grnas_for_csv = []
        for grna_id in selected_ids:
            if grna_id not in region['grnas']:
                continue

            grna = region['grnas'][grna_id].copy()
            grna['CRISPRi_flag'] = crispri_flag

            # New: Merge CRISPRi_score from the frontend
            if grna_id in frontend_grna_data:
                grna['CRISPRi_score'] = frontend_grna_data[grna_id].get('CRISPRi_score', 'N/A')

            grnas_for_csv.append(grna)

        # 5. Generate CSV (keep your logic exactly as it is)
        csv_content = []
        if grnas_for_csv:
            base_headers = [
                'ID', 'Start', 'End', 'Strand', 'ORF', 'Sequence',
                'PAM' if grnas_for_csv[0]['pam'] != 'NNN' else 'TAM',
                'C to T mutations', 'A to G mutations',
                '1bp mismatches', '2bp mismatches', 'Exact match'
            ]

            if crispri_flag and grnas_for_csv[0]['pam'] != 'NNN':
                base_headers.append('CRISPRi Score')
            elif not crispri_flag and grnas_for_csv[0]['pam'] != 'NNN':
                base_headers.append('CRISPR SCORE')

            csv_content.append(','.join(base_headers))

            for grna in grnas_for_csv:
                ctot = '"{}"'.format(",".join(grna.get('changed_aas', {}).get('CtoT', [])))
                atog = '"{}"'.format(",".join(grna.get('changed_aas', {}).get('AtoG', [])))

                fields = [
                    grna['id'],
                    grna['start'],
                    grna['end'],
                    grna['strand'],
                    grna['orf'],
                    grna['sequence'] if grna['pam'] != 'NNN' else grna.get('tnpb_Seq', ''),
                    grna['pam'] if grna['pam'] != 'NNN' else grna.get('tam', 'NNN'),
                    ctot,
                    atog,
                    grna.get('1bpmm', 0),
                    grna.get('2bpmm', 0),
                    grna.get('0bpmm', 0) + 1
                ]

                if crispri_flag and grna['pam'] != 'NNN':
                    fields.append(grna.get('CRISPRi_score', 'N/A'))
                elif not crispri_flag and grna['pam'] != 'NNN':
                    fields.append(grna.get('Mix_Score', 'N/A'))

                csv_content.append(','.join(map(str, fields)))

        # 6. Return Response (Maintain Original Format)
        return '\n'.join(csv_content), 200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="crispr-results.csv"'
        }

    except BadRequest as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500



@app.route('/api/v1.0/news', methods=['GET'])
def get_news():
    """Get a JSON version of the ATOM news feed"""

    feed = feedparser.parse("https://news.secondarymetabolites.org/feeds/tag-crispy.atom.xml")
    entries = []
    json_feed = dict(title=feed.feed.title, entries=entries)

    for entry in feed.entries[:5]:
        json_entry = {
            'title': entry.title,
            'link': entry.link,
            'published': entry.published,
            'summary': entry.summary,
        }
        entries.append(json_entry)

    return jsonify(json_feed)



# @app.route('/download/<path:filename>')
# def download_file(filename):
#     upload_path = app.config['UPLOAD_PATH']
#     absolute_path = os.path.abspath(upload_path)
#     print(f"UPLOAD_PATH的绝对路径是：{absolute_path}")
#     print(f"请求的文件路径是：{filename}")
#     return send_from_directory(upload_path, filename)



@app.route('/api/v1.0/seqs/PE', methods=['POST'])
def post_PE_seq():
    if not request.json or 'PESeq' not in request.json :
        raise BadRequest('no PESeq specified')
    session = create_session(from_PESeq=request.json['PESeq'])
    session_PESeq = session.PESeq

    prepare(session)


    data = dict(uri='/api/v1.0/genome', PESeq = session_PESeq)
    return jsonify(data)



