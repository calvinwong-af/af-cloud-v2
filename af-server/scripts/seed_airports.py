"""
scripts/seed_airports.py

Seeds the PostgreSQL `ports` table with airport data using IATA codes as un_code
and port_type = 'AIR'. All airports have has_terminals = False, terminals = [].

Idempotent — uses INSERT ... ON CONFLICT DO UPDATE.

Run with: python -m scripts.seed_airports
"""

import sys
import json

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text


AIRPORTS = [
    # Asia Pacific
    {"un_code": "KUL", "name": "Kuala Lumpur International Airport", "country": "Malaysia", "country_code": "MY"},
    {"un_code": "SZB", "name": "Sultan Abdul Aziz Shah Airport (Subang)", "country": "Malaysia", "country_code": "MY"},
    {"un_code": "PEN", "name": "Penang International Airport", "country": "Malaysia", "country_code": "MY"},
    {"un_code": "SIN", "name": "Singapore Changi Airport", "country": "Singapore", "country_code": "SG"},
    {"un_code": "CGK", "name": "Soekarno-Hatta International Airport", "country": "Indonesia", "country_code": "ID"},
    {"un_code": "BKK", "name": "Suvarnabhumi Airport", "country": "Thailand", "country_code": "TH"},
    {"un_code": "DMK", "name": "Don Mueang International Airport", "country": "Thailand", "country_code": "TH"},
    {"un_code": "MNL", "name": "Ninoy Aquino International Airport", "country": "Philippines", "country_code": "PH"},
    {"un_code": "HKG", "name": "Hong Kong International Airport", "country": "Hong Kong", "country_code": "HK"},
    {"un_code": "PVG", "name": "Shanghai Pudong International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "PEK", "name": "Beijing Capital International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "PKX", "name": "Beijing Daxing International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "CAN", "name": "Guangzhou Baiyun International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "SZX", "name": "Shenzhen Bao'an International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "NGB", "name": "Ningbo Lishe International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "XMN", "name": "Xiamen Gaoqi International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "TAO", "name": "Qingdao Jiaodong International Airport", "country": "China", "country_code": "CN"},
    {"un_code": "ICN", "name": "Incheon International Airport", "country": "South Korea", "country_code": "KR"},
    {"un_code": "NRT", "name": "Narita International Airport", "country": "Japan", "country_code": "JP"},
    {"un_code": "HND", "name": "Haneda Airport", "country": "Japan", "country_code": "JP"},
    {"un_code": "SGN", "name": "Tan Son Nhat International Airport", "country": "Vietnam", "country_code": "VN"},
    {"un_code": "HAN", "name": "Noi Bai International Airport", "country": "Vietnam", "country_code": "VN"},
    {"un_code": "DAD", "name": "Da Nang International Airport", "country": "Vietnam", "country_code": "VN"},
    {"un_code": "BOM", "name": "Chhatrapati Shivaji Maharaj International Airport", "country": "India", "country_code": "IN"},
    {"un_code": "DEL", "name": "Indira Gandhi International Airport", "country": "India", "country_code": "IN"},
    {"un_code": "MAA", "name": "Chennai International Airport", "country": "India", "country_code": "IN"},
    {"un_code": "CMB", "name": "Bandaranaike International Airport", "country": "Sri Lanka", "country_code": "LK"},
    {"un_code": "DAC", "name": "Hazrat Shahjalal International Airport", "country": "Bangladesh", "country_code": "BD"},
    {"un_code": "CGP", "name": "Shah Amanat International Airport", "country": "Bangladesh", "country_code": "BD"},
    {"un_code": "MLE", "name": "Velana International Airport", "country": "Maldives", "country_code": "MV"},
    {"un_code": "RGN", "name": "Yangon International Airport", "country": "Myanmar", "country_code": "MM"},
    {"un_code": "PNH", "name": "Phnom Penh International Airport", "country": "Cambodia", "country_code": "KH"},
    {"un_code": "VTE", "name": "Wattay International Airport", "country": "Laos", "country_code": "LA"},
    {"un_code": "SYD", "name": "Sydney Kingsford Smith Airport", "country": "Australia", "country_code": "AU"},
    {"un_code": "MEL", "name": "Melbourne Airport", "country": "Australia", "country_code": "AU"},
    {"un_code": "BNE", "name": "Brisbane Airport", "country": "Australia", "country_code": "AU"},
    {"un_code": "AKL", "name": "Auckland Airport", "country": "New Zealand", "country_code": "NZ"},
    # Middle East & South Asia
    {"un_code": "DXB", "name": "Dubai International Airport", "country": "United Arab Emirates", "country_code": "AE"},
    {"un_code": "AUH", "name": "Abu Dhabi International Airport", "country": "United Arab Emirates", "country_code": "AE"},
    {"un_code": "DOH", "name": "Hamad International Airport", "country": "Qatar", "country_code": "QA"},
    {"un_code": "BAH", "name": "Bahrain International Airport", "country": "Bahrain", "country_code": "BH"},
    {"un_code": "RUH", "name": "King Khalid International Airport", "country": "Saudi Arabia", "country_code": "SA"},
    {"un_code": "JED", "name": "King Abdulaziz International Airport", "country": "Saudi Arabia", "country_code": "SA"},
    {"un_code": "MCT", "name": "Muscat International Airport", "country": "Oman", "country_code": "OM"},
    {"un_code": "KWI", "name": "Kuwait International Airport", "country": "Kuwait", "country_code": "KW"},
    {"un_code": "AMM", "name": "Queen Alia International Airport", "country": "Jordan", "country_code": "JO"},
    {"un_code": "BEY", "name": "Beirut Rafic Hariri International Airport", "country": "Lebanon", "country_code": "LB"},
    {"un_code": "IST", "name": "Istanbul Airport", "country": "Turkey", "country_code": "TR"},
    {"un_code": "SAW", "name": "Istanbul Sabiha Gokcen International Airport", "country": "Turkey", "country_code": "TR"},
    {"un_code": "TBS", "name": "Tbilisi International Airport", "country": "Georgia", "country_code": "GE"},
    # Europe
    {"un_code": "LHR", "name": "London Heathrow Airport", "country": "United Kingdom", "country_code": "GB"},
    {"un_code": "LGW", "name": "London Gatwick Airport", "country": "United Kingdom", "country_code": "GB"},
    {"un_code": "AMS", "name": "Amsterdam Airport Schiphol", "country": "Netherlands", "country_code": "NL"},
    {"un_code": "FRA", "name": "Frankfurt Airport", "country": "Germany", "country_code": "DE"},
    {"un_code": "MUC", "name": "Munich Airport", "country": "Germany", "country_code": "DE"},
    {"un_code": "CDG", "name": "Charles de Gaulle Airport", "country": "France", "country_code": "FR"},
    {"un_code": "ORY", "name": "Paris Orly Airport", "country": "France", "country_code": "FR"},
    {"un_code": "MAD", "name": "Adolfo Suarez Madrid-Barajas Airport", "country": "Spain", "country_code": "ES"},
    {"un_code": "BCN", "name": "Josep Tarradellas Barcelona-El Prat Airport", "country": "Spain", "country_code": "ES"},
    {"un_code": "FCO", "name": "Leonardo da Vinci-Fiumicino Airport", "country": "Italy", "country_code": "IT"},
    {"un_code": "MXP", "name": "Milan Malpensa Airport", "country": "Italy", "country_code": "IT"},
    {"un_code": "ZUR", "name": "Zurich Airport", "country": "Switzerland", "country_code": "CH"},
    {"un_code": "VIE", "name": "Vienna International Airport", "country": "Austria", "country_code": "AT"},
    {"un_code": "BRU", "name": "Brussels Airport", "country": "Belgium", "country_code": "BE"},
    {"un_code": "ARN", "name": "Stockholm Arlanda Airport", "country": "Sweden", "country_code": "SE"},
    {"un_code": "CPH", "name": "Copenhagen Airport", "country": "Denmark", "country_code": "DK"},
    {"un_code": "OSL", "name": "Oslo Airport", "country": "Norway", "country_code": "NO"},
    {"un_code": "HEL", "name": "Helsinki-Vantaa Airport", "country": "Finland", "country_code": "FI"},
    {"un_code": "WAW", "name": "Warsaw Chopin Airport", "country": "Poland", "country_code": "PL"},
    {"un_code": "PRG", "name": "Vaclav Havel Airport Prague", "country": "Czech Republic", "country_code": "CZ"},
    {"un_code": "BUD", "name": "Budapest Ferenc Liszt International Airport", "country": "Hungary", "country_code": "HU"},
    {"un_code": "OTP", "name": "Henri Coanda International Airport", "country": "Romania", "country_code": "RO"},
    {"un_code": "SVO", "name": "Sheremetyevo International Airport", "country": "Russia", "country_code": "RU"},
    {"un_code": "DME", "name": "Domodedovo International Airport", "country": "Russia", "country_code": "RU"},
    # Americas
    {"un_code": "JFK", "name": "John F. Kennedy International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "LAX", "name": "Los Angeles International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "ORD", "name": "O'Hare International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "ATL", "name": "Hartsfield-Jackson Atlanta International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "DFW", "name": "Dallas/Fort Worth International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "MIA", "name": "Miami International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "SEA", "name": "Seattle-Tacoma International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "SFO", "name": "San Francisco International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "IAD", "name": "Washington Dulles International Airport", "country": "United States", "country_code": "US"},
    {"un_code": "YYZ", "name": "Toronto Pearson International Airport", "country": "Canada", "country_code": "CA"},
    {"un_code": "YVR", "name": "Vancouver International Airport", "country": "Canada", "country_code": "CA"},
    {"un_code": "YUL", "name": "Montreal-Trudeau International Airport", "country": "Canada", "country_code": "CA"},
    {"un_code": "GRU", "name": "Sao Paulo-Guarulhos International Airport", "country": "Brazil", "country_code": "BR"},
    {"un_code": "BOG", "name": "El Dorado International Airport", "country": "Colombia", "country_code": "CO"},
    {"un_code": "MEX", "name": "Mexico City International Airport", "country": "Mexico", "country_code": "MX"},
    # Africa
    {"un_code": "JNB", "name": "O.R. Tambo International Airport", "country": "South Africa", "country_code": "ZA"},
    {"un_code": "CPT", "name": "Cape Town International Airport", "country": "South Africa", "country_code": "ZA"},
    {"un_code": "NBO", "name": "Jomo Kenyatta International Airport", "country": "Kenya", "country_code": "KE"},
    {"un_code": "ADD", "name": "Addis Ababa Bole International Airport", "country": "Ethiopia", "country_code": "ET"},
    {"un_code": "LOS", "name": "Murtala Muhammed International Airport", "country": "Nigeria", "country_code": "NG"},
    {"un_code": "ACC", "name": "Kotoka International Airport", "country": "Ghana", "country_code": "GH"},
    {"un_code": "CMN", "name": "Mohammed V International Airport", "country": "Morocco", "country_code": "MA"},
    {"un_code": "CAI", "name": "Cairo International Airport", "country": "Egypt", "country_code": "EG"},
]

UPSERT_SQL = text("""
    INSERT INTO ports (un_code, name, country, country_code, port_type, has_terminals, terminals)
    VALUES (:un_code, :name, :country, :country_code, 'AIR', FALSE, CAST(:terminals AS jsonb))
    ON CONFLICT (un_code) DO UPDATE SET
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        country_code = EXCLUDED.country_code,
        port_type = EXCLUDED.port_type,
        has_terminals = EXCLUDED.has_terminals,
        terminals = EXCLUDED.terminals
""")


def main():
    engine = get_engine()
    count = 0

    with engine.connect() as conn:
        for airport in AIRPORTS:
            conn.execute(UPSERT_SQL, {
                "un_code": airport["un_code"],
                "name": airport["name"],
                "country": airport["country"],
                "country_code": airport["country_code"],
                "terminals": json.dumps([]),
            })
            count += 1
        conn.commit()

    print(f"Done. {count} airports upserted to PostgreSQL.")


if __name__ == "__main__":
    main()
