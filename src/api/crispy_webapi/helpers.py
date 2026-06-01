"""Helper functions for the webapi"""

import os
import valkey
from flask import g, abort
from crispy_models.models import Session, Queue

def create_session(from_id=None, from_file=None):
    """Create a new Session object"""
    session = Session(_get_db(), from_id=from_id, from_file=from_file)
    #TODO: Add session to queue
    return session


def get_session(session_id):
    try:
        session = Session(_get_db(), session_id=session_id)
        #FIXME: Use proper session handling
        return session
    except ValueError:
        abort(404)


def prepare(session):
    """Prepare a session for running CRISPy"""
    queue = Queue(_get_db(), 'prepare')
    queue.submit(session)


def scan(session):
    """Scan a genome for PAMs"""
    queue = Queue(_get_db(), 'scan')
    queue.submit(session)


def _get_db():
    valkey_store = getattr(g, '_database', None)
    if valkey_store is None:
        url = os.getenv('CRISPY_VALKEY_URL', os.getenv('CRISPY_REDIS_URL', 'redis://localhost:6379/0'))
        valkey_store = valkey.from_url(url, decode_responses=True)
        setattr(g, '_database', valkey_store)
    return valkey_store

