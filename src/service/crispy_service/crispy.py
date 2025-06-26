from typing import Dict, List, Union

from Bio.SeqFeature import FeatureLocation
from Bio.SeqRecord import SeqRecord

from nearmiss import Searcher
import math


def find_position_differences(seq1, seq2):
    if len(seq1) != len(seq2):
        raise ValueError("the sequence is not the same length")

    differences = []

    for i in range(len(seq1)):
        if seq1[i] != seq2[i]:
            differences.append([i, seq1[i] + seq2[i]])  # (索引, seq1中的字符, seq2中的字符)

    return differences





def build_comparison_text(records: List[SeqRecord], window_size: int) -> str:
    """ Builds a single string containing forward and reverse strands of all
        record sequences, separated by a large enough section of '$' characters
        to prevent the uniqueness window from matching any of the neighbouring
        sequences.

        Arguments:
            records: a dictionary of record id to SeqRecord instance
            window_size: the size of the unique window

        Returns:
            a string of the combined sequences
    """
    seqs = []
    separator = "$" * window_size
    for record in records:
        seqs.append(str(record.seq))
        seqs.append(str(record.seq.reverse_complement()))
    return separator.join(seqs)


def crispy_scan(haystack: List[SeqRecord], needle: SeqRecord, pam: str = "GG",
                unique_size: int = 13, full_size: int = 23, threads: int = -1,
                ) -> List[Dict[str, Union[str, int]]]:
    # print('pam is '+ str(pam)+"====================================================================================================")
    if unique_size < 1:
        raise ValueError("unique size cannot be below 1")
    if full_size < unique_size:
        raise ValueError("full size cannot be below unique size")
#get how many base
    def build_json_base(location, result,seq_section,GC_content,Self_complementarity, TnpB_seq = "NNNNNNNNNN",CRISPRi_score = 0,Mix_Score = 0) -> Dict[str, Union[str, int]]:
        base = {
            'start': location.start + 5,
            'end': location.end - 5,
            'strand': location.strand,
            'sequence': str(seq_section[0:-3]),
            'pam': str(seq_section[-3:]),
            'tam':"TTGAT",
            'all_hits': result,  # new to JSON, for handy sorting
            "CRISPRi_score":CRISPRi_score,
            "Mix_Score":Mix_Score,
            "GC_content":GC_content,
            "Self_complementarity":Self_complementarity,
            "tnpb_Seq":str(TnpB_seq[5:]),
            '0bpmm': result[0] - 2,  # remove self-hit
        }

        # print(seq_section[:-3])
        # add remaining mismatch info
        for i, val in enumerate(result[1:]):
            base['{}bpmm'.format(i+1)] = val//2
        # print(result)
        # print(base['1bpmm'],"=======================base")
        # print("hey,i have updated base")
        return base

    # set the size of the window to the unique size
    # and shift one back since in the previous system it skipped a leading N
    before_window = (-unique_size - 1, -1)
    #for TnpB protein
    TnpB_window = (5, 18)
    # Cas3_window = (-27,-1)

    final_result = []

    comparison_text = build_comparison_text(haystack, unique_size)
    #Score_Sys_start===============================================================================================================
    #first  version score sys
    score_sys = {"CA":[0.428,0.571,0.333,0.4,0.263,0.21,0.214,0.273,0,0.176,0.19,0.207,0.227],"GA":[0.733,0.667,0.556,0.65,0.722,0.652,0.467,0.65,0.192,0.176,0.4,0.375,0.765],
                 "TA":[0.429,0.6,0.882,0.308,0.333,0.3,0.533,0.2,0,0.133,0.5,0.538,0.6],"AC":[0.65,0.857,0.867,0.75,0.714,0.385,0.35,0.222,1,0.467,0.538,0.429,0.5],
                 "GC":[0.643,0.619,0.389,0.25,0.444,0.136,0,0.05,0.154,0.059,0.133,0.125,0.059],"TC":[0.875,0.875,0.941,0.308,0.538,0.7,0.733,0.067,0.308,0.467,0.643,0.462,0.3],
                 "AG":[1,0.643,0.933,1,0.933,0.923,0.75,0.941,1,0.933,0.692,0.714,0.938],"CG":[0.615,0.538,0.4,0.429,0.529,0.421,0.429,0.273,0,0.235,0.476,0.448,0.429],
                 "TG":[0.625,0.533,0.813,0.385,0.385,0.3,0.267,0.143,0,0.25,0.667,0.667,0.7],"AT":[0.8,0.929,0.857,0.75,0.8,0.692,0.619,0.579,0.909,0.533,0.667,0.286,0.563],
                 "CT":[1,0.923,0.533,0.667,0.947,0.789,0.286,0.273,0.667,0.706,0.429,0.276,0.091],"GT":[0.733,0.619,0.5,0.4,0.5,0.261,0,0.05,0.346,0.118,0.333,0.25,0.176]}
    combine_eff = {1:0.29,2:0.33,3:0.32,4:0.31,5:0.31,6:0.3,7:0.3,8:0.31,9:0.33,10:0.35,11:0.355,12:0.34,13:0.38}

    #second version
    ##################################################################################################################Table####################################################################################
    STEM_LEN = 4
    DOENCH_2014 = {"Intercept": 0.5976361543,
                   "G23": -0.2753771278, "TG22": -0.625778696,
                   "A22": -0.3238874564, "C22": 0.1721288713,
                   "C21": -0.1006662089,
                   "C20": -0.20180294, "G20": 0.2459566331, "CG19": 0.3000433167,
                   "C19": 0.0983768352, "A19": 0.0364400412, "AA18": -0.8348362447, "AT18": 0.7606277721,
                   "C18": -0.7411812913, "G18": -0.3932643973, "GG17": -0.4908167494,
                   "A13": -0.4660990147, "GG12": -1.5169074394, "AT12": 0.7092612002, "CT12": 0.4962986088,
                   "TT12": -0.5868738941,
                   "GG11": -0.3345637351,
                   "AG10": 0.7638499303, "CG10": -0.5370251697,
                   "A10": 0.0853769455, "C10": -0.0138139718,
                   "A9": 0.2726205124, "C9": -0.119022648, "T9": -0.2859442224,
                   "A8": 0.0974545916, "G8": -0.1755461698, "GT7": -0.7981461328,
                   "C7": -0.3457954508, "G7": -0.6780964263,
                   "A6": 0.2250890296, "C6": -0.5077940514, "GG5": -0.6668087295, "CT5": 0.3531832525,
                   "G5": -0.4173735974, "T5": -0.0543069593, "CC4": 0.7480720923, "GT4": -0.3672667722,
                   "G4": 0.379899366, "T4": -0.0907126437, "CA3": 0.5682091316, "GC3": 0.3290720742,
                   "AG3": -0.8364567552, "GG3": -0.7822075841,
                   "C3": 0.0578233185, "T3": -0.5305672958, "CT2": -1.0296929571,
                   "T2": -0.8770074285, "GC1": 0.8561978226, "TC1": -0.4632076791,
                   "C1": -0.8762358461, "G1": 0.2789162593, "T1": -0.4031022177, "AA0": -0.5794923887,
                   "GA0": 0.6490755373,
                   "PAMC1": 0.287935617, "PAMA1": -0.0773007042, "PAMT1": -0.2216372166, "PAMAG1": -0.0773007042,
                   "PAMCG1": 0.287935617, "PAMTG1": -0.2216372166,
                   "1G": -0.6890166818, "1T": 0.1178775773,
                   "2C": -0.1604453039, "2GG": -0.6977400239,
                   "3G": 0.3863425849,
                   "gc_low": -0.2026258943,
                   "gc_high": -0.166587752}
    XU_2015_CRISPRi = [[0,0.006447933,-0.002556713,0.02067124,-0.01541201,0.006701975,0.003990316,-0.005194459,-0.02852648,-0.009598615,0.01047803,0.02912254,0.004315982,0.01410663,0.0376519,0.01593133,0.02561585,-0.01040574,0.04550361,0.0248649],
                       [0,-0.005126545,0.01784427,0.001810971,-0.006865736,-0.009327798,0.008476303,-0.002546783,0.009015268,0.002571972,-0.009462136,-0.01410245,-0.006850088,-0.003234736,-0.003153252,0.025584,-0.02293057,0.005392964,-0.01997099,-0.04276305],
                       [0,0.01868168,-0.001228439,0.009265117,0.02225981,0.01266799,0.01163767,0.02465747,0.03048746,0.01891338,0.03431422,0.002359817,0.02789401,-0.01502249,-0.02123348,-0.03391245,0.01418497,0.009837631,0.003354427,0.03505556],
                       [0,-0.0263186,-0.02082668,-0.03726897,-0.007179623,-0.01061834,-0.03195586,-0.02884586,-0.02578712,-0.02318647,-0.04550686,-0.01265939,-0.03952176,0.01281278,-0.00178908,0.000224124,-0.01378385,-0.01119136,-0.0156738,-0.01229142]]
    XU_2015 = {'C18': -0.113781378,
               'G17': 0.080289971,
               'A16': 0.025840846, 'G16': 0.072680697,
               'G15': 0.100642827,
               'G14': 0.082839514,
               'T14': -0.070933894,
               'A12': 0.02156311,
               'A11': 0.129118902,
               'A10': 0.030483786, 'T10': -0.169986128,
               'A9': 0.093646913,
               'G7': -0.214271553, 'T7': 0.073750154,
               'A6': 0.202820147,
               'A5': 0.129158071,
               'G4': 0.107523301, 'T4': -0.349240474,
               'C3': 0.23502822, 'T3': -0.145493093,
               'G2': 0.238517854, 'T2': -0.300975354,
               'C1': -0.125927965, 'G1': 0.353047311, 'T1': -0.221752041,
               'PAMT1': -0.155910373,
               '1C': 0.179639101,
               '4T': -0.116646129}
    SCORE = {"INPAIR_OFFTARGET_0": 5000,
             "INPAIR_OFFTARGET_1": 500,
             "INPAIR_OFFTARGET_2": 50,
             "INPAIR_OFFTARGET_3": 5,
             "OFFTARGET_PAIR_SAME_STRAND": 10000,
             "OFFTARGET_PAIR_DIFF_STRAND": 5000,
             "PAM_IN_PENALTY": 1000,
             "MAX_OFFTARGETS": 20000,  ## FIX: SPECIFIC FOR TALEN AND CRISPR
             "COEFFICIENTS": 100,  # also used for RNA folding in ISOFORM mode
             "CRISPR_BAD_GC": 300,
             "FOLDING": 1}

    SINGLE_OFFTARGET_SCORE = [0, 0.6, 0.8]
    GC_LOW = 40
    GC_HIGH = 70

    G_20 = {"Intercept": -30,
            "G1": 60}

    CRISPR_DEFAULT = {"GUIDE_SIZE": 20,
                      "PAM": "NGG",
                      "MAX_OFFTARGETS": 300,
                      "MAX_MISMATCHES": 3,
                      "SCORE_GC": False,  # this is already scored in many models!
                      "SCORE_FOLDING": True}
    CoefficientsScore = {"XU_2015": 0,
                         "DOENCH_2014": 0,
                         "DOENCH_2016": 0,
                         "MORENO_MATEOS_2015": 0,
                         "CHARI_2015": 0,
                         "G_20": 0,
                         "ALKAN_2018": 0,
                         "ZHANG_2019": 0}

######################################################################################################################table end############################################################################
#####################################################################################################################score func start#####################################################################
    def scoregRNA(seq, PAM, tail, lookup,Tot_Fal_Match_Score):
        """ Calculate score from model coefficients. score is 0-1, higher is better """
        score = 0
        if "Intercept" in lookup:
            score = lookup["Intercept"]

        seq = seq[::-1]  # we calculate from PAM in a way: 321PAM123

        if "gc_low" in lookup:
            gc = seq[:20].count('G') + seq[:20].count('C')
            if gc < 10:
                score = score + (abs(gc - 10) * lookup["gc_low"])
            elif gc > 10:
                score = score + ((gc - 10) * lookup["gc_high"])

        for i in range(len(seq)):
            key = seq[i] + str(i + 1)
            if key in lookup:
                score += lookup[key]

            if i + 1 < len(seq):
                double_key = seq[i] + seq[i + 1] + str(i + 1)
                if double_key in lookup:
                    score += lookup[double_key]

            if i == 0:
                double_key = PAM[0] + seq[0] + str(0)
                if double_key in lookup:
                    score += lookup[double_key]

        for i in range(len(PAM)):
            key = 'PAM' + PAM[i] + str(i + 1)
            if key in lookup:
                score += lookup[key]

            if i + 1 < len(PAM):
                double_key = 'PAM' + PAM[i] + PAM[i + 1] + str(i + 1)
                if double_key in lookup:
                    score += lookup[double_key]

        for i in range(len(tail)):
            key = str(i + 1) + tail[i]
            if key in lookup:
                score += lookup[key]

            if i + 1 < len(tail):
                double_key = str(i + 1) + tail[i] + tail[i + 1]
                if double_key in lookup:
                    score += lookup[double_key]



        score -= Tot_Fal_Match_Score

        score = 1 / (1 + math.e ** -score)
        return score

    # 计算自环罚分(Calculate the penalty points from the loop)
    def calcSelfComplementarity(seq, backbone_regions):



        rvsseq = str(seq[::-1])
        L = len(seq) - 4 - 1

        folding = 0

        for i in range(0, len(seq) - 4):
            if gccontent(seq[i:i + 4]) >= 0.5:
                if str(seq[i:i + 4]) in str(rvsseq[0:(L - i)]) or any(
                        [str(seq[i:i + 4]) in str(item) for item in backbone_regions]):
                    # sys.stderr.write("%s\t%s\n" % (fwd, fwd[i:i+STEM_LEN]))
                    folding += 1
        return folding

    # 计算GC含量罚分(Calculate penalty points for GC content)
    def calcGCContent(seq):
        """ Calculate the GC content of the guide """

        gSeq = seq[0:(None if PAM == "" else -len(PAM))]
        Gcount = gSeq.count('G')
        Ccount = gSeq.count('C')
        GCcontent = (100 * (float(Gcount + Ccount) / int(len(gSeq))))
        return GCcontent



    def TnpB_calcGCContent(seq):
        """ Calculate the GC content of the guide """

        gSeq = seq[(None if TAM == "" else 4):]
        Gcount = gSeq.count('G')
        Ccount = gSeq.count('C')
        GCcontent = (100 * (float(Gcount + Ccount) / int(len(gSeq))))
        return GCcontent

    def gccontent(seq):
        gc = 0
        for i in seq:
            if i == 'G' or i == 'g' or i == 'C' or i == 'c':
                gc += 1
        return float(gc) / float(len(seq))
    ###################################################################################################################score Func end#########################################################################################
    idx = 0
    for strand in [1, -1]:
        if strand == -1:
            searcher = Searcher(str(needle.seq.reverse_complement()))
        else:
            #it depend on this to find mismatch
            searcher = Searcher(str(needle.seq))
        print("pam =  "+pam)
        if pam == "GG":

            results = searcher.find_repeat_counts(target=pam, before_window=before_window,
                                                  other_text=comparison_text, threads=threads)[0]
            results_seq = searcher.find_repeat_counts(target=pam, before_window=before_window,
                                                  other_text=comparison_text, threads=threads)[1]
        # elif pam == "TTC":
        #     results = searcher.find_repeat_counts(target=pam, before_window=Cas3_window,
        #                                           other_text=comparison_text, threads=threads)[0]
        #     results_seq = searcher.find_repeat_counts(target=pam, before_window=Cas3_window,
        #                                               other_text=comparison_text, threads=threads)[1]
        else:
            # print("pam = " + pam)
            results = searcher.find_repeat_counts(target=pam, before_window=TnpB_window,
                                                  other_text=comparison_text, threads=threads)[0]
            # print(results)
            results_seq = searcher.find_repeat_counts(target=pam, before_window=TnpB_window,
                                                      other_text=comparison_text, threads=threads)[1]


        if pam == 'GG':
            for pam_start, result in sorted(results.items(), key=lambda x: x[1]):
                # print(result)
                # set the window location, accounting for strand
                if strand == -1:
                    start = len(needle.seq) - pam_start - len(pam)
                    end = start + full_size
                    sim_seq = results_seq[list(results.keys()).index(pam_start)]

                    if len(sim_seq) == 1:

                        Tot_Fal_Match_Score = 0
                    else:
                        Tot_Fal_Match_Score = 0
                        for other_seq in sim_seq[1:]:
                            if len(find_position_differences(sim_seq[0],other_seq)) == 1:
                                Fal_Match_Score = eval(format((1 - score_sys[find_position_differences(sim_seq[0],other_seq)[0][1]][find_position_differences(sim_seq[0],other_seq)[0][0]]),'.2f'))
                                Tot_Fal_Match_Score += SINGLE_OFFTARGET_SCORE[1]*Fal_Match_Score


                            elif len(find_position_differences(sim_seq[0],other_seq)) == 2:

                                d = abs(find_position_differences(sim_seq[0],other_seq)[0][0] - find_position_differences(sim_seq[0],other_seq)[1][0])
                                Fal_Match_Score = eval(format((1 - score_sys[find_position_differences(sim_seq[0],other_seq)[0][1]][find_position_differences(sim_seq[0],other_seq)[0][0]] * score_sys[find_position_differences(sim_seq[0],other_seq)[1][1]][find_position_differences(sim_seq[0],other_seq)[1][0]]* combine_eff[d]), '.2f'))
                                Tot_Fal_Match_Score += SINGLE_OFFTARGET_SCORE[2]*Fal_Match_Score


                            else:

                                continue



                else:
                    start = pam_start - full_size + len(pam)
                    end = pam_start + len(pam)
                    sim_seq = results_seq[list(results.keys()).index(pam_start)]

                    if len(sim_seq) == 1:
                        Tot_Fal_Match_Score = 0
                    else:
                        Tot_Fal_Match_Score = 0

                        for other_seq in sim_seq[1:]:

                            if len(find_position_differences(sim_seq[0],other_seq)) == 1:
                                # print(find_position_differences(sim_seq[0],other_seq))
                                Fal_Match_Score = eval(format((
                                            1 - score_sys[find_position_differences(sim_seq[0], other_seq)[0][1]][
                                        find_position_differences(sim_seq[0], other_seq)[0][0]]), '.2f'))
                                Tot_Fal_Match_Score += SINGLE_OFFTARGET_SCORE[1]*Fal_Match_Score


                            elif len(find_position_differences(sim_seq[0],other_seq)) == 2:
                                # print(find_position_differences(sim_seq[0], other_seq))
                                d = abs(find_position_differences(sim_seq[0], other_seq)[0][0] -
                                        find_position_differences(sim_seq[0], other_seq)[1][0])
                                Fal_Match_Score = eval(format((1 - score_sys[find_position_differences(sim_seq[0],other_seq)[0][1]][find_position_differences(sim_seq[0],other_seq)[0][0]] * score_sys[find_position_differences(sim_seq[0],other_seq)[1][1]][find_position_differences(sim_seq[0],other_seq)[1][0]]* combine_eff[d]), '.2f'))
                                Tot_Fal_Match_Score += SINGLE_OFFTARGET_SCORE[2]*Fal_Match_Score


                            else:

                                continue



                # skip anything for which the full window shown would be truncated
                if start - 5 < 0 or end + 5 >= len(needle.seq):
                    continue

                location = FeatureLocation(start - 5, end + 5, strand)#4+23+5
                Seq = location.extract(needle.seq)
                Seq = Seq[1:]


                seq = Seq[4:-8]
                PAM = Seq[-8:-5]

                downstream5prim = Seq[:4]
                downstream3prim = Seq[-5:]
                CRISPRi_score = 0


                # Due to CRISPRi's low tolerance to mismatch, off-target matching is temporarily excluded from CRISPRi scores.
                # Calculate CRISPRi score here
                if full_size == 23:
                    for index,item in enumerate(seq):
                        if item == "A":
                            CRISPRi_score += XU_2015_CRISPRi[0][index]
                        elif item == "C":
                            CRISPRi_score += XU_2015_CRISPRi[1][index]
                        elif item == "G":
                            CRISPRi_score += XU_2015_CRISPRi[2][index]
                        elif item == "T":
                            CRISPRi_score += XU_2015_CRISPRi[3][index]
                    CRISPRi_score = 1/(1.0+math.exp(-CRISPRi_score))
                    XU_2015_score = scoregRNA(downstream5prim+seq, PAM, downstream3prim, XU_2015,Tot_Fal_Match_Score)
                    DOENCH_2014_score = scoregRNA(downstream5prim+seq, PAM, downstream3prim, DOENCH_2014,Tot_Fal_Match_Score)
                    XU_2015_score = round(XU_2015_score*100, 1)
                    DOENCH_2014_score = round(DOENCH_2014_score * 100, 1)
                    Mix_Score = "{:.1f}".format((XU_2015_score + DOENCH_2014_score)/2)
                    CRISPRi_score = round(CRISPRi_score * 100, 1)
                    # 格式化显示一位小数
                    XU_2015_score = "{:.1f}".format(XU_2015_score)
                    DOENCH_2014_score = "{:.1f}".format(DOENCH_2014_score)
                    # Mix_Score = "{:.1f}".format(Mix_Score)
                    CRISPRi_score = "{:.1f}".format(CRISPRi_score)
                    # print(Mix_Score)

                    if result[0] != 2:
                        XU_2015_score = 0
                        DOENCH_2014_score = 0
                else:
                    CRISPRi_score = 0
                    Mix_Score = 0


                GC_content = calcGCContent(seq)
                Self_complementarity = calcSelfComplementarity(seq,["AGGCTAGTCCGT"])


                final_result.append(build_json_base(location, result, seq+PAM,GC_content,Self_complementarity,"NNNNNNNNNN",CRISPRi_score,Mix_Score))
                idx += 1
        else:
            for pam_start, result in sorted(results.items(), key=lambda x: x[1]):
                # set the window location, accounting for strand
                if strand == -1:
                    start = len(needle.seq) - pam_start - full_size
                    end = start + full_size
                else:
                    start = pam_start
                    end = pam_start + full_size
                # skip anything for which the full window shown would be truncated
                if start < 0 or end >= len(needle.seq):
                    continue
                # print(strand)

                location = FeatureLocation(start, end, strand)
                seq = location.extract(needle.seq)
                # print(str(seq)+"======================================")
                TAM = seq[:4]
                # print(seq)
                GC_content = TnpB_calcGCContent(seq)
                Self_complementarity = calcSelfComplementarity(seq, ["AGGCTAGTCCGT"])
                final_result.append(build_json_base(location, result, "NNNNN",GC_content,Self_complementarity,TnpB_seq=seq))
                idx += 1

    # order by lowest hits, then by start position
    print("type===========================================================",final_result[:10])
    final_result.sort(key=lambda x: (x["all_hits"], x["start"]))

    # for i in final_result:
    #     print(i["score"])



    return final_result
