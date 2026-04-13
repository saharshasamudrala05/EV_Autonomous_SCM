import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os

# ==========================================
# 1. CONFIGURATION & STYLING (FIXED SIDEBAR)
# ==========================================
st.set_page_config(page_title="Global EV Data Explorer", layout="wide")

# IEA Official Colors
IEA_BLUE = "#0047c8"
IEA_NAVY = "#0a2b5e"
IEA_TEAL = "#00cfda"
IEA_GREY = "#f2f2f2"
IEA_ORANGE = "#f2a900" 

# CSS OVERRIDES
st.markdown(f"""
    <style>
    /* 1. Main Background to White */
    .stApp {{
        background-color: white !important;
    }}
    
    /* 2. Main Content Text to Black - COMPREHENSIVE */
    .main p, .main h1, .main h2, .main h3, .main div, .main span, .main label {{
        color: black !important;
    }}
    
    /* Ensure all text elements are visible */
    .element-container, .stMarkdown, .stMarkdown p, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {{
        color: black !important;
    }}
    
    /* Title styling - force black on all headers */
    h1, h2, h3, h4, h5, h6 {{
        color: black !important;
    }}
    
    /* Markdown text containers */
    [data-testid="stMarkdownContainer"] {{
        color: black !important;
    }}
    
    [data-testid="stMarkdownContainer"] p, 
    [data-testid="stMarkdownContainer"] strong,
    [data-testid="stMarkdownContainer"] span,
    [data-testid="stMarkdownContainer"] div {{
        color: black !important;
    }}
    
    /* All paragraph and text elements */
    p, span, div {{
        color: black !important;
    }}

    /* 3. SIDEBAR STYLING (FIXED) */
    section[data-testid="stSidebar"] {{
        background-color: #262730 !important; /* Dark Sidebar like Streamlit default */
    }}
    
    section[data-testid="stSidebar"] h1, section[data-testid="stSidebar"] label {{
        color: white !important;
    }}
    
    /* Dropdown/Selectbox styling - Text visibility */
    .stSelectbox div[data-baseweb="select"] > div {{
        background-color: #0e1117 !important;
        color: white !important;
        border: 1px solid {IEA_BLUE};
    }}
    
    /* The selected option text - more specific targeting */
    .stSelectbox div[data-baseweb="select"] span,
    .stSelectbox div[data-baseweb="select"] div,
    .stSelectbox [role="button"] {{
        color: white !important;
    }}
    
    /* Dropdown menu options */
    [data-baseweb="popover"] li,
    [data-baseweb="menu"] li,
    [role="option"] {{
        color: white !important;
        background-color: #0e1117 !important;
    }}
    
    /* Dropdown menu hover state */
    [data-baseweb="menu"] li:hover,
    [role="option"]:hover {{
        background-color: {IEA_BLUE} !important;
        color: white !important;
    }}
    
    /* Radio Buttons */
    .stRadio label {{
        color: white !important;
    }}
    </style>
    """, unsafe_allow_html=True)

# ==========================================
# 2. DATA LOADER
# ==========================================
@st.cache_data
def load_data():
    # Attempt multiple paths
    paths = [
        r"C:\Users\Admin\Documents\AI_SCM_Project\Gevo_EV_2025.xlsx",
        "Gevo_EV_2025.xlsx - Sheet1.csv",
        "Gevo_EV_2025.xlsx"
    ]
    
    df = None
    for path in paths:
        try:
            if os.path.exists(path) or path.endswith('.xlsx'):
                if path.endswith('.csv'):
                    df = pd.read_csv(path)
                else:
                    df = pd.read_excel(path)
                break
        except:
            continue
            
    if df is not None:
        df['year'] = pd.to_numeric(df['year'], errors='coerce')
        return df
    return pd.DataFrame()

df = load_data()

# ==========================================
# 3. SIDEBAR CONTROLS
# ==========================================
st.sidebar.title("IEA Data Explorer")

if df.empty:
    st.error("Data file not found. Please ensure 'Gevo_EV_2025.xlsx' is in the folder.")
    st.stop()

# 1. View Type
view_type = st.sidebar.radio("Time Horizon", ["Historical", "Projected"], index=0)
category_filter = "Historical" if view_type == "Historical" else "Projection-STEPS"

# 2. Parameter (Smart Filter)
# We sort them to prioritize the ones you mentioned
valid_params = df[df['category'] == category_filter]['parameter'].unique()
priority_order = ['EV sales', 'EV stock', 'EV sales share', 'EV stock share', 'Battery demand', 'Oil displacement Mbd', 'EV charging points']
sorted_params = sorted(valid_params, key=lambda x: priority_order.index(x) if x in priority_order else 99)

parameter = st.sidebar.selectbox("Metric", sorted_params, index=0)

# 3. Region
region_options = sorted(df['region_country'].unique())
default_reg = list(region_options).index('World') if 'World' in region_options else 0
region = st.sidebar.selectbox("Region", region_options, index=default_reg)

# 4. Mode
valid_modes = df[
    (df['region_country'] == region) & 
    (df['parameter'] == parameter)
]['mode'].unique()

if len(valid_modes) > 0:
    mode = st.sidebar.selectbox("Vehicle/Mode", valid_modes, index=0)
else:
    st.sidebar.warning("No data for this combo.")
    st.stop()

# 5. Powertrain (Conditionals)
powertrain_options = df['powertrain'].unique()
# Default selection logic based on metric
if 'charging' in parameter.lower():
    defaults = [x for x in powertrain_options if 'Publicly' in x]
elif 'oil' in parameter.lower():
    defaults = ['EV']
else:
    defaults = ['BEV', 'PHEV']
    
# Filter available powertrains for this specific slice to avoid empty options
valid_pts = df[
    (df['region_country'] == region) & 
    (df['parameter'] == parameter) & 
    (df['mode'] == mode)
]['powertrain'].unique()

show_powertrain = st.sidebar.multiselect("Technology / Powertrain", valid_pts, default=[x for x in defaults if x in valid_pts])

# ==========================================
# 4. VISUALIZATION ENGINE
# ==========================================
st.title(f"{region}: {parameter}")
st.markdown(f"**Mode:** {mode} | **Scenario:** {view_type}")

# Filter Data
mask = (df['region_country'] == region) & \
       (df['parameter'] == parameter) & \
       (df['mode'] == mode) & \
       (df['category'] == category_filter) & \
       (df['powertrain'].isin(show_powertrain))

chart_data = df[mask].groupby(['year', 'powertrain'])['value'].sum().reset_index()
chart_data = chart_data.sort_values('year')

if not chart_data.empty:
    
    # --- LOGIC SWITCH FOR CHART TYPES ---
    
    # A. SHARES (% Graphs) -> Line Chart
    if 'share' in parameter.lower():
        fig = px.line(chart_data, x='year', y='value', color='powertrain',
                      color_discrete_sequence=[IEA_BLUE, IEA_TEAL, IEA_NAVY],
                      markers=True, template="plotly_white")
        fig.update_layout(yaxis_title="Percentage (%)", yaxis_ticksuffix="%")
        fig.update_traces(line=dict(width=4))

    # B. OIL DISPLACEMENT -> Area Chart (IEA Style)
    elif 'oil' in parameter.lower() or 'displacement' in parameter.lower():
        fig = px.area(chart_data, x='year', y='value', color='powertrain',
                      color_discrete_sequence=[IEA_ORANGE, IEA_NAVY],
                      template="plotly_white")
        fig.update_layout(yaxis_title="Million Barrels / Day")

    # C. CHARGING POINTS -> Stacked Bar (Fast vs Slow)
    elif 'charging' in parameter.lower():
        fig = px.bar(chart_data, x='year', y='value', color='powertrain',
                     color_discrete_sequence=[IEA_TEAL, IEA_BLUE],
                     template="plotly_white")
        fig.update_layout(yaxis_title="Number of Connectors")

    # D. SALES / STOCK / BATTERY -> Stacked Bar
    else:
        fig = px.bar(chart_data, x='year', y='value', color='powertrain',
                     color_discrete_sequence=[IEA_BLUE, IEA_TEAL, IEA_NAVY, "#888888"],
                     template="plotly_white")
        
        # Unit labelling
        if 'battery' in parameter.lower():
             fig.update_layout(yaxis_title="GWh")
        else:
             fig.update_layout(yaxis_title="Vehicles")

    # COMMON CHART STYLING
    fig.update_layout(
        font=dict(color='black', family="Arial"),
        xaxis=dict(showgrid=False, title=None),
        yaxis=dict(showgrid=True, gridcolor='#eee'),
        legend=dict(orientation="h", y=1.1, title=None),
        hovermode="x unified",
        margin=dict(l=0, r=0, t=0, b=0),
        height=500
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # Data Table
    with st.expander("View Data Table"):
        st.dataframe(chart_data.pivot(index='year', columns='powertrain', values='value'))

else:
    st.warning(f"No data available for this selection.")
    st.info("Try selecting a different Parameter or Mode.")