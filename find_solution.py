import pandas as pd
import matplotlib.pyplot as plt

# 1. LOAD THE TECH GUIDE
file_path = r"C:\Users\Admin\Documents\AI_SCM_Project\IEA\IEA_Clean_Tech_Guide.csv"
df = pd.read_csv(file_path)

# 2. FILTER FOR BATTERY SOLUTIONS
# We want "Battery" technologies that are NOT "Lithium-ion" (since that's the bottleneck)
# OR we want "Recycling" (to recover lithium).
candidates = df[
    (df['supplyChain'].str.contains('Battery', na=False)) & 
    (df['name'].str.contains('Sodium|Solid-state|Recycling', case=False))
].copy()

# 3. CLEAN TRL DATA (Handle ranges like "8-9")
def clean_trl(val):
    if pd.isna(val): return 0
    s = str(val)
    if '-' in s:
        return (float(s.split('-')[0]) + float(s.split('-')[1])) / 2
    try:
        return float(s)
    except:
        return 0

df['TRL_2024_Score'] = df['trl2024'].apply(clean_trl)
candidates['TRL_2024_Score'] = candidates['trl2024'].apply(clean_trl)

# 4. SELECT THE WINNERS (Must be TRL >= 8 to save us in 2026)
winners = candidates[candidates['TRL_2024_Score'] >= 8].sort_values('TRL_2024_Score', ascending=False)
losers = candidates[candidates['TRL_2024_Score'] < 8].sort_values('TRL_2024_Score', ascending=False)

print("\n--- STRATEGIC RECOMMENDATIONS (The Solution) ---")
print(f"CRISIS: We need to fill a 28 GWh gap in 2026.\n")

print("✅ OPTION A: DEPLOY IMMEDIATELY (Mature Tech)")
print(winners[['name', 'trl2024', 'description']].head(3).to_string(index=False))

print("\n❌ OPTION B: DO NOT RELY ON YET (R&D Only)")
print(losers[['name', 'trl2024']].head(3).to_string(index=False))

# 5. VISUALIZE THE STRATEGY
plt.figure(figsize=(10, 5))
colors = ['green' if x >= 8 else 'red' for x in candidates['TRL_2024_Score']]
plt.barh(candidates['name'], candidates['TRL_2024_Score'], color=colors)
plt.axvline(x=9, color='black', linestyle='--', label='Commercial Readiness')
plt.xlabel('Technology Readiness Level (TRL)')
plt.title('Solution Strategy: Which Tech is Ready for 2026?')
plt.legend()
plt.tight_layout()
plt.savefig('Solution_Strategy.png')
print("\n[+] Strategy Chart saved as 'Solution_Strategy.png'")