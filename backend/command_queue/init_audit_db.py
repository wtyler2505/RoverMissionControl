"""
Initialize audit database tables for command history
Run this script to create the enhanced audit tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import create_engine
from backend.database import DATABASE_URL
from backend.command_queue.audit_models import Base
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_audit_tables():
    """Create audit tables in the database"""
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Create all tables defined in audit_models
        Base.metadata.create_all(bind=engine)
        
        logger.info("Audit tables created successfully")
        
        # Log created tables
        for table in Base.metadata.tables:
            logger.info(f"Created table: {table}")
            
    except Exception as e:
        logger.error(f"Failed to create audit tables: {e}")
        raise


if __name__ == "__main__":
    init_audit_tables()