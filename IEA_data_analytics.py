import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# ==========================================
# 1. LOAD DATA & CLEAN DUPLICATES (The Fix)
# ==========================================
# Updated for your file path
file_path = r"C:\Users\Admin\Documents\AI_SCM_Project\Gevo_EV_2025.xlsx"

print(f"📊 Loading dataset: {file_path}...")

try:
    df = pd.read_excel(file_path)
    print("✅ File loaded successfully!")
except Exception as e:
    print(f"❌ Error loading file: {e}")
    print("   Tip: Make sure the file is .xlsx and not .csv renamed!")
    exit()

# --- INTELLIGENT CLEANING STEP ---
print("🧹 Cleaning data (Removing overlaps between Historical & Projections)...")

# 1. Filter for relevant categories
df = df[df['category'].isin(['Historical', 'Projection-STEPS'])].copy()

# 2. Prioritize Historical Data
# Create a 'priority' column: Historical = 1, Projection = 2
df['priority'] = df['category'].map({'Historical': 1, 'Projection-STEPS': 2})
df = df.sort_values('priority')

# 3. Drop Duplicates
# If we have (China, 2024) in both Historical and Projection, keep the first one (Historical)
keys = ['region_country', 'parameter', 'mode', 'powertrain', 'year']
df_clean = df.drop_duplicates(subset=keys, keep='first')

print(f"   Original Rows: {len(df)}")
print(f"   Cleaned Rows:  {len(df_clean)}")
df = df_clean # Use clean data moving forward

# ==========================================
# 2. PREPARE DASHBOARD DATA
# ==========================================
print("⚙️ Processing Global EV Analytics...")

# Helper to safely get World data
def get_world_data(df, param):
    mask = (df['parameter'] == param)
    data = df[mask].groupby(['year', 'region_country'])['value'].sum().unstack(level=1)
    
    if 'World' in data.columns:
        return data['World']
    return data.sum(axis=1)

# --- FILTER 1: GLOBAL SALES VOLUME (Stacked) ---
mask_sales = (df['parameter'] == 'EV sales') & (df['mode'] == 'Cars')
sales_data = df[mask_sales].groupby(['region_country', 'year'])['value'].sum().unstack(level=0).fillna(0)

key_regions = ['China', 'Europe', 'USA']
valid_regions = [r for r in key_regions if r in sales_data.columns]

if 'World' in sales_data.columns:
    sales_data['Rest of World'] = sales_data['World'] - sales_data[valid_regions].sum(axis=1)
    sales_data['Rest of World'] = sales_data['Rest of World'].clip(lower=0)
    final_sales = sales_data[valid_regions + ['Rest of World']]
else:
    final_sales = sales_data[valid_regions]

# --- FILTER 2: MARKET SHARE (S-Curve) ---
mask_share = (df['parameter'] == 'EV sales share') & (df['mode'] == 'Cars')
target_regions = ['Norway', 'China', 'Europe', 'USA', 'World']
share_data = df[mask_share & df['region_country'].isin(target_regions)]

# FIX: Use pivot_table with aggfunc='sum' to combine BEV + PHEV shares
if not share_data.empty:
    share_data = share_data.pivot_table(index='year', columns='region_country', values='value', aggfunc='sum')

# --- FILTER 3: OIL DISPLACEMENT ---
oil_data = get_world_data(df, 'Oil displacement Mbd')

# --- FILTER 4: BATTERY DEMAND ---
battery_data = get_world_data(df, 'Battery demand')

# ==========================================
# 3. GENERATE "COMMAND CENTER" DASHBOARD
# ==========================================
plt.rcParams.update({
    "figure.facecolor": "#0d1117",
    "axes.facecolor": "#0d1117",
    "axes.edgecolor": "white",
    "text.color": "white",
    "xtick.color": "white", "ytick.color": "white",
    "grid.color": "#30363d",
    "axes.prop_cycle": plt.cycler('color', ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#a371f7'])
})

fig, axes = plt.subplots(2, 2, figsize=(18, 10))
fig.suptitle('GLOBAL EV INTELLIGENCE: 2025 OUTLOOK', fontsize=24, weight='bold', color='#58a6ff')

# --- PLOT 1: SALES VOLUME ---
if not final_sales.empty:
    colors = ['#f85149', '#58a6ff', '#d29922', '#8b949e'] 
    final_sales.loc[2015:2030].plot(kind='area', stacked=True, ax=axes[0, 0], color=colors, alpha=0.85)
    axes[0, 0].set_title('Global EV Sales Volume (Million Units)', fontsize=14, weight='bold')
    axes[0, 0].set_ylabel('Vehicles')
    axes[0, 0].grid(False)
    axes[0, 0].legend(loc='upper left', facecolor='#0d1117', framealpha=0.5)

# --- PLOT 2: MARKET SHARE ---
if not share_data.empty:
    share_data.loc[2015:2030].plot(ax=axes[0, 1], linewidth=3)
    axes[0, 1].set_title('Market Penetration (% Share)', fontsize=14, weight='bold')
    axes[0, 1].set_ylabel('Share (%)')
    axes[0, 1].legend(loc='upper left', facecolor='#0d1117', framealpha=0.5)
    axes[0, 1].grid(True, linestyle='--', alpha=0.3)

# --- PLOT 3: OIL DISPLACEMENT ---
if not oil_data.empty:
    axes[1, 0].fill_between(oil_data.index, oil_data.values, color='#3fb950', alpha=0.6)
    axes[1, 0].plot(oil_data.index, oil_data.values, color='#3fb950', linewidth=2)
    axes[1, 0].set_title('Oil Displacement (Million Barrels/Day)', fontsize=14, weight='bold')
    axes[1, 0].set_xlim(2015, 2030)

# --- PLOT 4: BATTERY DEMAND ---
if not battery_data.empty:
    axes[1, 1].bar(battery_data.index, battery_data.values, color='#a371f7', alpha=0.8)
    axes[1, 1].set_title('Global Battery Demand (GWh)', fontsize=14, weight='bold')
    axes[1, 1].set_ylabel('GWh')
    axes[1, 1].set_xlim(2015, 2030)

plt.tight_layout(rect=[0, 0.03, 1, 0.95])
output_file = 'Global_EV_Dashboard.png'
plt.savefig(output_file, dpi=300, facecolor='#0d1117')
print(f"\n✅ Dashboard Generated Successfully: '{output_file}'")
print("(Check your folder for the image)")
plt.show()