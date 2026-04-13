import psycopg2
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
import h3
import time
import re

# --- UNIVERSAL H3 WRAPPER ---
def get_h3_index(lat, lng, res=6):
    # In H3 v4, 'geo_to_h3' and 'latlng_to_h3' are now 'latlng_to_cell'
    try:
        return h3.latlng_to_cell(lat, lng, res)
    except AttributeError:
        # This is the fallback for older v3 versions just in case
        return h3.geo_to_h3(lat, lng, res)
# Database Connection
conn = psycopg2.connect(
    dbname="nexus_scm", 
    user="postgres", 
    password="saharsha", 
    host="localhost",
    port="5432"
)
cur = conn.cursor()

geolocator = Nominatim(user_agent="nexus_scm_final")
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1.5)

cur.execute("SELECT node_id, name FROM public.network_nodes WHERE loc_h3_index IS NULL;")
nodes = cur.fetchall()

print(f"Processing {len(nodes)} nodes with Smart Fallback...")

for node_id, name in nodes:
    location = None
    
    # 1. Aggressive cleaning to find the actual PLACE
    # Removes (brackets), /slashes, and specific logistical jargon
    clean_name = re.sub(r'\(.*?\)', '', name) # Remove anything in brackets
    clean_name = re.sub(r'/.*', '', clean_name) # Remove anything after a slash
    clean_name = re.sub(r'(Sez|Icd|Rto|Dto|Srto|Rta|Ltd|Apiic|Cfs|Lcs|Acc|Sea|Airport|Cargo|Mmlp|Ftwz|Seepz|Epz|Uo)', '', clean_name, flags=re.I).strip()
    clean_name = clean_name.replace(',', ' ').replace(' - ', ' ')

    # 2. Construct intelligent search queries
    search_queries = []
    
    # If it's an RTO (contains state), use "City, State"
    if " - " in name:
        parts = name.split(" - ")
        search_queries.append(f"{parts[0].replace('Rto', '').strip()}, {parts[1]}, India")
    
    # Add the cleaned full name
    search_queries.append(f"{clean_name}, India")
    
    # Add the last word ONLY if it is longer than 3 characters (prevents 'Be', 'Ap', 'Tn')
    last_word = clean_name.split(' ')[-1]
    if len(last_word) > 3:
        search_queries.append(f"{last_word}, India")

    # 3. Execution with validation
    for query in search_queries:
        if len(query.replace(", India", "").strip()) < 3: # Skip too-short queries
            continue
            
        try:
            location = geocode(query)
            if location:
                # IMPORTANT: Validate that the location is actually in India
                if "India" in location.address:
                    break
                else:
                    location = None
        except:
            continue
    
    if location:
        h3_idx = get_h3_index(location.latitude, location.longitude)
        cur.execute("UPDATE public.network_nodes SET loc_h3_index = %s WHERE node_id = %s", (h3_idx, node_id))
        conn.commit()
        print(f"✅ VERIFIED: {name} -> {h3_idx} (found via: {query})")
    else:
        print(f"❌ SKIPPED: {name} (No reliable location found)")
cur.close()
conn.close()