"""
Datetime helper - PostgreSQL timezone compatibility
PostgreSQL DateTime fields are timezone-aware (UTC)
Python datetime.utcnow() is timezone-naive
This helper ensures timezone-aware datetime for PostgreSQL compatibility
"""
from datetime import datetime, timezone


def utcnow():
    """
    Returns timezone-aware UTC datetime for PostgreSQL compatibility
    
    Returns:
        datetime: Current UTC time with timezone info
    """
    return datetime.now(timezone.utc)


def utc_timestamp():
    """
    Returns UTC timestamp
    
    Returns:
        float: UTC timestamp
    """
    return datetime.now(timezone.utc).timestamp()
