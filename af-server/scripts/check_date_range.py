import os, psycopg2
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
url = os.environ['DATABASE_URL'].replace('postgresql+psycopg2://', 'postgresql://')
conn = psycopg2.connect(url)
cur = conn.cursor()

# Check how many air rows have effective_to set vs open-ended
cur.execute("""
    SELECT
        COUNT(*) FILTER (WHERE effective_to IS NULL) AS open_ended,
        COUNT(*) FILTER (WHERE effective_to IS NOT NULL) AS closed,
        MIN(effective_to) FILTER (WHERE effective_to IS NOT NULL) AS earliest_close,
        MAX(effective_to) FILTER (WHERE effective_to IS NOT NULL) AS latest_close
    FROM air_freight_rates
""")
print('air_freight_rates effective_to breakdown:', cur.fetchone())

# Same for haulage
cur.execute("""
    SELECT
        COUNT(*) FILTER (WHERE effective_to IS NULL) AS open_ended,
        COUNT(*) FILTER (WHERE effective_to IS NOT NULL) AS closed,
        MIN(effective_to) FILTER (WHERE effective_to IS NOT NULL) AS earliest_close,
        MAX(effective_to) FILTER (WHERE effective_to IS NOT NULL) AS latest_close
    FROM haulage_rates
""")
print('haulage_rates effective_to breakdown:', cur.fetchone())

# Sample: oldest surviving rows per group for air — do they have effective_to set?
cur.execute("""
    SELECT id, rate_card_id, supplier_id, effective_from, effective_to
    FROM air_freight_rates
    ORDER BY rate_card_id, supplier_id NULLS FIRST, effective_from ASC
    LIMIT 20
""")
print('\nSample oldest air rows per group (effective_to check):')
for row in cur.fetchall():
    print(' ', row)

cur.close()
conn.close()
