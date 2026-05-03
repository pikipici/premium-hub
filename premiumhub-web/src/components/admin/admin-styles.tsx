"use client"

export default function AdminStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

      :root {
        --orange: #FF5733; --dark: #141414; --muted: #888; --border: #EBEBEB;
        --bg: #F7F7F5; --white: #fff; --sidebar-w: 224px; --content-max: 1220px;
        --green: #22C55E; --yellow: #F59E0B; --red: #EF4444; --blue: #3B82F6;
      }

      .admin-page-wrapper {
        font-family: 'Plus Jakarta Sans', sans-serif;
        background: var(--bg);
        color: var(--dark);
        -webkit-font-smoothing: antialiased;
        display: flex;
        min-height: 100vh;
      }

      /* SIDEBAR */
      .sidebar {
        width: var(--sidebar-w);
        min-height: 100vh;
        background: var(--dark);
        display: flex;
        flex-direction: column;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 100;
        padding: 0 0 24px;
        transition: width .18s ease;
      }
      .sidebar-logo { padding: 22px 20px 18px; border-bottom: 1px solid rgba(255,255,255,.07); margin-bottom: 8px; }
      .sidebar-logo .logo-text { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
      .sidebar-logo .logo-text span { color: var(--orange); }
      .sidebar-logo .admin-tag { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.3); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
      .nav-section { padding: 8px 12px 4px; }
      .nav-section-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,.25); padding: 0 8px; margin-bottom: 4px; display: block; }
      .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,.5); cursor: pointer; transition: all .15s; margin-bottom: 1px; text-decoration: none; }
      .nav-item:hover { background: rgba(255,255,255,.07); color: rgba(255,255,255,.85); }
      .nav-item.active { background: rgba(255,255,255,.1); color: #fff; }
      .nav-icon { font-size: 15px; opacity: .6; flex-shrink: 0; width: 20px; text-align: center; }
      .nav-text { min-width: 0; }
      .nav-badge { margin-left: auto; font-size: 10px; font-weight: 700; background: var(--orange); color: #fff; padding: 2px 7px; border-radius: 100px; min-width: 20px; text-align: center; }
      .nav-badge.yellow { background: var(--yellow); }
      .nav-badge.red { background: var(--red); }
      .sidebar-bottom { margin-top: auto; padding: 12px 12px 0; border-top: 1px solid rgba(255,255,255,.07); }
      .admin-profile { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; cursor: pointer; transition: background .15s; }
      .admin-profile:hover { background: rgba(255,255,255,.07); }
      .admin-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
      .admin-name { font-size: 13px; font-weight: 600; color: #fff; }
      .admin-role { font-size: 11px; color: rgba(255,255,255,.35); }

      .admin-page-wrapper.sidebar-collapsed .sidebar {
        width: 72px;
      }
      .admin-page-wrapper.sidebar-collapsed .sidebar-logo {
        padding: 14px 8px 12px;
      }
      .admin-page-wrapper.sidebar-collapsed .sidebar-logo .logo-text {
        font-size: 15px;
        text-align: center;
      }
      .admin-page-wrapper.sidebar-collapsed .nav-section {
        padding: 8px 8px 4px;
      }
      .admin-page-wrapper.sidebar-collapsed .nav-section-label {
        display: none;
      }
      .admin-page-wrapper.sidebar-collapsed .nav-item {
        justify-content: center;
        gap: 0;
        padding: 9px 8px;
      }
      .admin-page-wrapper.sidebar-collapsed .nav-text,
      .admin-page-wrapper.sidebar-collapsed .nav-badge,
      .admin-page-wrapper.sidebar-collapsed .admin-profile-meta {
        display: none;
      }
      .admin-page-wrapper.sidebar-collapsed .sidebar-bottom {
        padding: 10px 8px 0;
      }
      .admin-page-wrapper.sidebar-collapsed .admin-profile {
        justify-content: center;
        padding: 8px 6px;
      }

      /* MAIN */
      .admin-main { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; transition: margin-left .18s ease; }
      .admin-page-wrapper.sidebar-collapsed .admin-main { margin-left: 72px; }

      /* TOPBAR */
      .topbar { height: 54px; background: var(--white); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; position: sticky; top: 0; z-index: 90; }
      .topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .topbar-title-wrap { min-width: 0; }
      .topbar-left h1 { font-size: 14px; font-weight: 700; letter-spacing: -0.2px; }
      .topbar-left p { font-size: 10px; color: var(--muted); margin-top: 1px; }
      .mobile-menu-btn {
        display: none;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--white);
        color: var(--dark);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
      }
      .mobile-menu-btn:hover { border-color: var(--dark); }
      .topbar-right { display: flex; align-items: center; gap: 6px; }
      .sidebar-toggle-btn {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .1px;
        padding: 5px 9px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--white);
        color: var(--dark);
        cursor: pointer;
        transition: all .15s;
      }
      .sidebar-toggle-btn:hover { border-color: var(--dark); }
      .topbar-btn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--white); color: var(--dark); cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px; text-decoration: none; }
      .topbar-btn:hover { border-color: var(--dark); }
      .topbar-btn.primary { background: var(--orange); border-color: var(--orange); color: #fff; }
      .topbar-btn.primary:hover { opacity: .88; }
      .admin-catalog-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 12px; }
      .admin-catalog-tab { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 800; line-height: 1; padding: 8px 12px; min-height: 36px; border-radius: 10px; border: 1px solid var(--border); background: var(--white); color: var(--dark); cursor: pointer; transition: border-color .15s, background .15s, color .15s, box-shadow .15s; display: inline-flex; align-items: center; justify-content: center; gap: 9px; white-space: nowrap; text-decoration: none; }
      .admin-catalog-tab:hover { border-color: #CBD5E1; background: #F8FAFC; }
      .admin-catalog-tab.is-active { background: var(--orange); border-color: var(--orange); color: #fff; box-shadow: 0 8px 18px rgba(255, 88, 55, .18); }
      .admin-catalog-tab.is-active:hover { background: var(--orange); border-color: var(--orange); opacity: .94; }
      .admin-catalog-tab-count { display: inline-flex; align-items: center; justify-content: center; padding: 2px 7px; border-radius: 999px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #64748B; font-size: 10px; font-weight: 800; line-height: 1.3; white-space: nowrap; }
      .admin-catalog-tab-count.is-active { border-color: rgba(255,255,255,.42); background: rgba(255,255,255,.22); color: #fff; }
      .notif-wrap { position: relative; }
      .notif-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; position: relative; transition: border-color .15s; }
      .notif-btn:hover { border-color: var(--dark); }
      .notif-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; background: var(--orange); border-radius: 50%; border: 1.5px solid white; }

      .notif-count {
        position: absolute;
        top: -5px;
        right: -6px;
        min-width: 17px;
        height: 17px;
        border-radius: 999px;
        background: var(--orange);
        color: #fff;
        border: 1px solid #fff;
        font-size: 10px;
        font-weight: 700;
        line-height: 15px;
        text-align: center;
        padding: 0 4px;
      }
      .notif-popover {
        position: absolute;
        right: 0;
        top: 40px;
        width: min(380px, calc(100vw - 26px));
        background: var(--white);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 16px 34px rgba(15, 23, 42, .22);
        z-index: 130;
        overflow: hidden;
      }
      .notif-popover-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
        background: #FAFAFA;
      }
      .notif-popover-title { font-size: 12px; font-weight: 700; color: var(--dark); }
      .notif-popover-sub { font-size: 11px; color: var(--muted); margin-top: 1px; }
      .notif-popover-actions { display: flex; align-items: center; gap: 6px; }
      .notif-link-btn {
        border: 0;
        background: transparent;
        color: var(--dark);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }
      .notif-link-btn:disabled { opacity: .45; cursor: default; }
      .notif-popover-body { max-height: min(420px, 68vh); overflow: auto; }
      .notif-empty { padding: 16px 12px; font-size: 12px; color: var(--muted); text-align: center; }
      .notif-item {
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 10px 12px;
        border-bottom: 1px solid #F2F2F2;
        display: grid;
        gap: 4px;
      }
      .notif-item:last-child { border-bottom: 0; }
      .notif-item:hover { background: #FAFAFA; }
      .notif-item:disabled { opacity: .65; cursor: default; }
      .notif-item.unread { background: #FFF7ED; }
      .notif-item-title { font-size: 12px; font-weight: 700; color: var(--dark); }
      .notif-item-message { font-size: 12px; color: #4B5563; line-height: 1.35; }
      .notif-item-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 10px;
        color: var(--muted);
      }
      .notif-item-chip {
        padding: 2px 6px;
        border-radius: 999px;
        background: var(--orange);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
      }

      /* MOBILE LAYOUT HELPERS */
      .admin-desktop-only { display: block; }
      .admin-mobile-only { display: none; }
      .admin-mobile-bottom-nav { display: none; }

      .admin-mobile-drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 108;
        background: rgba(20,20,20,.45);
        opacity: 0;
        pointer-events: none;
        border: 0;
        transition: opacity .18s ease;
      }
      .admin-mobile-drawer-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      .admin-mobile-drawer {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: min(86vw, 320px);
        background: var(--dark);
        color: #fff;
        z-index: 109;
        border-right: 1px solid rgba(255,255,255,.08);
        display: flex;
        flex-direction: column;
        transform: translateX(-102%);
        transition: transform .2s ease;
        box-shadow: 14px 0 28px rgba(0,0,0,.25);
      }
      .admin-mobile-drawer.open { transform: translateX(0); }
      .admin-mobile-drawer-head {
        padding: 14px 12px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .admin-mobile-drawer-logo {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -.3px;
      }
      .admin-mobile-drawer-logo span { color: var(--orange); }
      .admin-mobile-drawer-sub {
        margin-top: 2px;
        font-size: 10px;
        color: rgba(255,255,255,.45);
        text-transform: uppercase;
        letter-spacing: .9px;
      }
      .admin-mobile-drawer-close {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.16);
        background: transparent;
        color: rgba(255,255,255,.82);
        cursor: pointer;
      }
      .admin-mobile-drawer-scroll {
        overflow: auto;
        padding: 10px 10px 12px;
        display: grid;
        gap: 10px;
      }
      .admin-mobile-drawer-label {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255,255,255,.32);
        text-transform: uppercase;
        letter-spacing: .8px;
        margin: 0 6px 4px;
      }
      .admin-mobile-drawer-items {
        display: grid;
        gap: 4px;
      }
      .admin-mobile-drawer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 36px;
        border-radius: 10px;
        padding: 8px 10px;
        color: rgba(255,255,255,.7);
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
      }
      .admin-mobile-drawer-item.active {
        background: rgba(255,255,255,.12);
        color: #fff;
      }
      .admin-mobile-drawer-item-badge {
        margin-left: auto;
        font-size: 10px;
        font-weight: 700;
        background: var(--orange);
        color: #fff;
        min-width: 20px;
        text-align: center;
        border-radius: 999px;
        padding: 2px 7px;
      }
      .admin-mobile-drawer-item-badge.yellow { background: var(--yellow); }
      .admin-mobile-drawer-item-badge.red { background: var(--red); }
      .admin-mobile-drawer-icon {
        width: 18px;
        text-align: center;
        opacity: .85;
        flex-shrink: 0;
      }
      .admin-mobile-drawer-actions {
        margin-top: auto;
        border-top: 1px solid rgba(255,255,255,.08);
        padding: 10px;
        display: grid;
        gap: 6px;
      }
      .admin-mobile-drawer-action {
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 9px;
        padding: 8px 10px;
        text-decoration: none;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
      }
      .admin-mobile-drawer-action:hover {
        background: rgba(255,255,255,.08);
      }

      .mobile-page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
      .mobile-page-title { font-size: 13px; font-weight: 700; color: var(--dark); }
      .mobile-page-subtitle { font-size: 11px; color: var(--muted); }
      .mobile-inline-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .mobile-chip-btn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 600; border: 1px solid var(--border); background: var(--white); border-radius: 999px; padding: 5px 10px; color: var(--dark); }
      .mobile-chip-btn.primary { background: var(--dark); color: #fff; border-color: var(--dark); }

      .mobile-card-list { display: flex; flex-direction: column; gap: 8px; }
      .mobile-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
      .mobile-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
      .mobile-card-title {
        font-size: 12px;
        font-weight: 700;
        color: var(--dark);
        line-height: 1.3;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .mobile-card-sub {
        font-size: 10px;
        color: var(--muted);
        margin-top: 2px;
        line-height: 1.35;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .mobile-card-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
        font-size: 11px;
      }
      .mobile-card-label {
        color: var(--muted);
        flex: 0 0 84px;
        min-width: 84px;
      }
      .mobile-card-value {
        color: var(--dark);
        font-weight: 600;
        text-align: right;
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .mobile-card-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-top: 10px;
      }
      .mobile-card-actions .action-btn,
      .mobile-card-actions .g-approve,
      .mobile-card-actions .g-reject,
      .mobile-card-actions .stok-add-btn {
        width: 100%;
        min-width: 0;
        justify-content: center;
        text-align: center;
      }
      .mobile-card-actions > :nth-child(3):last-child {
        grid-column: 1 / -1;
      }

      .mobile-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
      .mobile-kpi-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
      .mobile-kpi-label { font-size: 10px; color: var(--muted); margin-bottom: 4px; }
      .mobile-kpi-value { font-size: 16px; font-weight: 800; color: var(--dark); letter-spacing: -0.4px; }
      .mobile-kpi-change { font-size: 10px; margin-top: 3px; }
      .mobile-kpi-change.up { color: var(--green); }
      .mobile-kpi-change.warn { color: var(--yellow); }

      .mobile-quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
      .mobile-quick-btn { font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid var(--border); background: var(--white); border-radius: 12px; padding: 10px; text-align: left; }
      .mobile-quick-btn strong { display: block; font-size: 12px; margin-bottom: 2px; color: var(--dark); }
      .mobile-quick-btn span { font-size: 10px; color: var(--muted); }

      .mobile-chart-tabs { margin-bottom: 8px; }
      .mobile-chart-tabs .chart-tab { padding: 4px 8px; font-size: 10px; }
      .mobile-chart-wrap { padding: 2px 0 0; }
      .mobile-chart-area { height: 104px; gap: 4px; }

      .mobile-fab { position: fixed; right: 14px; bottom: 76px; z-index: 88; border: none; border-radius: 999px; background: var(--orange); color: #fff; font-weight: 700; font-size: 12px; padding: 10px 14px; box-shadow: 0 10px 20px rgba(20,20,20,.18); }

      /* PAGE */
      .page { padding: 14px 16px; width: min(100%, var(--content-max)); margin: 0 auto; }

      /* METRICS */
      .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
      .metric-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 12px; transition: box-shadow .2s; }
      .metric-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.06); }
      .metric-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .metric-label { font-size: 10px; font-weight: 500; color: var(--muted); }
      .metric-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; }
      .metric-icon.green { background: #DCFCE7; }
      .metric-icon.orange { background: #FEF3C7; }
      .metric-icon.red { background: #FEE2E2; }
      .metric-icon.blue { background: #DBEAFE; }
      .metric-value { font-size: 17px; font-weight: 800; letter-spacing: -0.4px; color: var(--dark); margin-bottom: 2px; }
      .metric-change { font-size: 10px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
      .metric-change.up { color: var(--green); }
      .metric-change.down { color: var(--red); }
      .metric-change.warn { color: var(--yellow); }

      /* ALERT BAR */
      .alert-bar { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 9px 12px; display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 11px; color: #92400E; }
      .alert-bar strong { font-weight: 600; }
      .alert-bar a { color: var(--orange); text-decoration: underline; cursor: pointer; }

      /* GRID */
      .grid-2 { display: grid; grid-template-columns: 1fr 300px; gap: 10px; margin-bottom: 10px; }
      .grid-2-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

      /* CARD */
      .card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
      .card-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); }
      .card-header h2 { font-size: 12px; font-weight: 700; letter-spacing: -0.2px; }
      .card-header-right { display: flex; align-items: center; gap: 8px; }
      .link-btn { font-size: 11px; font-weight: 600; color: var(--muted); background: none; border: none; cursor: pointer; transition: color .15s; font-family: 'Plus Jakarta Sans', sans-serif; }
      .link-btn:hover { color: var(--dark); }

      /* CHART */
      .chart-wrap { padding: 12px; }
      .chart-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
      .chart-tab { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 7px; border: 1px solid var(--border); background: var(--white); color: var(--muted); cursor: pointer; transition: all .15s; }
      .chart-tab.active { background: var(--dark); border-color: var(--dark); color: #fff; }
      .chart-area { height: 160px; position: relative; display: flex; align-items: flex-end; gap: 6px; }
      .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
      .bar { width: 100%; border-radius: 5px 5px 0 0; background: var(--bg); transition: background .2s; cursor: pointer; position: relative; }
      .bar:hover { background: var(--orange) !important; }
      .bar.highlight { background: var(--orange) !important; }
      .bar-label { font-size: 10px; color: var(--muted); }
      .chart-tooltip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: var(--dark); color: #fff; font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 6px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .15s; }
      .bar:hover .chart-tooltip { opacity: 1; }

      /* TABLE */
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { font-size: 10px; font-weight: 700; color: var(--muted); text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; letter-spacing: .2px; }
      td { padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #FAFAF8; }
      .order-id { font-weight: 700; color: var(--dark); font-size: 11px; }
      .order-buyer { font-weight: 600; color: var(--dark); font-size: 11px; }
      .order-email { font-size: 10px; color: var(--muted); margin-top: 1px; }
      .product-pill { display: inline-flex; align-items: center; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 100px; padding: 2px 7px; font-size: 10px; font-weight: 600; color: var(--dark); white-space: nowrap; }
      .status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 100px; white-space: nowrap; }
      .status-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
      .s-lunas { background: #DCFCE7; color: #166534; }
      .s-lunas::before { background: #22C55E; }
      .s-pending { background: #FEF3C7; color: #92400E; }
      .s-pending::before { background: #F59E0B; }
      .s-gagal { background: #FEE2E2; color: #991B1B; }
      .s-gagal::before { background: #EF4444; }
      .s-proses { background: #DBEAFE; color: #1E40AF; }
      .s-proses::before { background: #3B82F6; }
      .action-btn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 600; padding: 4px 7px; border-radius: 7px; border: 1px solid var(--border); background: var(--white); color: var(--dark); cursor: pointer; transition: all .15s; }
      .action-btn:hover { background: var(--dark); color: #fff; border-color: var(--dark); }
      .action-btn.orange { background: var(--orange); border-color: var(--orange); color: #fff; }
      .action-btn.orange:hover { opacity: .85; }

      /* STOK */
      .stok-list { padding: 8px 0; }
      .stok-item { display: flex; align-items: center; padding: 7px 10px; gap: 9px; transition: background .12s; cursor: pointer; }
      .stok-item:hover { background: #FAFAF8; }
      .stok-icon { font-size: 22px; width: 36px; text-align: center; flex-shrink: 0; }
      .stok-info { flex: 1; min-width: 0; }
      .stok-name { font-size: 11px; font-weight: 600; color: var(--dark); }
      .stok-meta { font-size: 9px; color: var(--muted); margin-top: 1px; }
      .stok-bar-wrap { flex: 1; }
      .stok-bar-bg { height: 5px; background: var(--bg); border-radius: 100px; overflow: hidden; margin-bottom: 3px; }
      .stok-bar-fill { height: 100%; border-radius: 100px; transition: width .3s; }
      .stok-count { font-size: 11px; font-weight: 600; text-align: right; }
      .stok-add-btn { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; font-weight: 700; padding: 3px 7px; border-radius: 7px; border: 1px solid var(--border); background: var(--white); color: var(--dark); cursor: pointer; transition: all .15s; white-space: nowrap; flex-shrink: 0; }
      .stok-add-btn:hover { background: var(--dark); color: #fff; border-color: var(--dark); }
      .stok-add-btn.orange { background: var(--orange); border-color: var(--orange); color: #fff; }
      .stok-add-btn.orange:hover { background: var(--orange); border-color: var(--orange); color: #fff; opacity: .9; }

      /* GARANSI */
      .garansi-list { padding: 8px 0; }
      .garansi-item { display: flex; align-items: center; padding: 7px 10px; gap: 9px; border-bottom: 1px solid var(--border); transition: background .12s; }
      .garansi-item:last-child { border-bottom: none; }
      .garansi-item:hover { background: #FAFAF8; }
      .garansi-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
      .garansi-info { flex: 1; min-width: 0; }
      .garansi-name { font-size: 11px; font-weight: 600; color: var(--dark); }
      .garansi-detail { font-size: 9px; color: var(--muted); margin-top: 1px; }
      .garansi-actions { display: flex; gap: 6px; flex-shrink: 0; }
      .g-approve { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; font-weight: 700; padding: 3px 7px; border-radius: 7px; border: none; background: #DCFCE7; color: #166534; cursor: pointer; transition: background .15s; }
      .g-approve:hover { background: #BBF7D0; }
      .g-reject { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; font-weight: 700; padding: 3px 7px; border-radius: 7px; border: none; background: #FEE2E2; color: #991B1B; cursor: pointer; transition: background .15s; }
      .g-reject:hover { background: #FECACA; }

      /* TOP PRODUCTS */
      .top-prod-list { padding: 8px 0; }
      .top-prod-item { display: flex; align-items: center; gap: 9px; padding: 7px 10px; transition: background .12s; }
      .top-prod-item:hover { background: #FAFAF8; }
      .top-prod-rank { font-size: 12px; font-weight: 700; color: var(--muted); width: 18px; text-align: center; flex-shrink: 0; }
      .rank-1 { color: #F59E0B; } .rank-2 { color: #9CA3AF; } .rank-3 { color: #92400E; }
      .top-prod-icon { font-size: 20px; flex-shrink: 0; }
      .top-prod-info { flex: 1; }
      .top-prod-name { font-size: 11px; font-weight: 600; color: var(--dark); }
      .top-prod-sales { font-size: 9px; color: var(--muted); margin-top: 1px; }
      .top-prod-rev { font-size: 11px; font-weight: 700; color: var(--dark); white-space: nowrap; }

      /* MINI STATS */
      .mini-stats { padding: 12px; display: flex; flex-direction: column; gap: 0; }
      .mini-stat { padding: 8px 0; border-bottom: 1px solid var(--border); }
      .mini-stat:last-child { border-bottom: none; }
      .mini-stat-label { font-size: 10px; color: var(--muted); margin-bottom: 2px; }
      .mini-stat-value { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; color: var(--dark); }
      .mini-stat-sub { font-size: 9px; color: var(--green); margin-top: 2px; font-weight: 600; }
      .mini-stat-sub.warn { color: var(--yellow); }

      .section-title { font-size: 13px; font-weight: 700; color: var(--dark); margin-bottom: 12px; letter-spacing: -0.2px; }

      /* EDIT PRODUK */
      .edit-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
      .edit-form-col { display: flex; flex-direction: column; gap: 16px; }
      .form-section { background: var(--white); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
      .form-section-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
      .form-section-header h3 { font-size: 14px; font-weight: 700; letter-spacing: -.2px; color: var(--dark); }
      .form-section-sub { font-size: 11px; color: var(--muted); background: var(--bg); padding: 3px 9px; border-radius: 100px; }
      .form-section-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
      .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      .form-field { display: flex; flex-direction: column; gap: 6px; }
      .form-label { font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: .3px; text-transform: uppercase; }
      .form-input, .form-textarea, .form-select {
        font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px;
        padding: 9px 12px; border: 1px solid var(--border); border-radius: 9px;
        background: var(--white); color: var(--dark); outline: none;
        transition: border-color .15s; width: 100%; box-sizing: border-box;
      }
      .form-input:focus, .form-textarea:focus { border-color: var(--dark); }
      .form-textarea { resize: vertical; line-height: 1.65; }
      .dynamic-list { display: flex; flex-direction: column; gap: 8px; }
      .dynamic-row { display: flex; align-items: center; gap: 8px; }
      .dynamic-row .form-input { flex: 1; }
      .spec-row { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 6px; align-items: center; }
      .btn-remove-row { width: 28px; height: 28px; border-radius: 7px; border: 1px solid #fecaca; background: #fff5f5; color: #EF4444; font-size: 14px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background .12s; font-family: sans-serif; }
      .btn-remove-row:hover { background: #fee2e2; }
      .btn-add-row { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 8px; border: 1.5px dashed var(--border); background: var(--bg); color: var(--muted); cursor: pointer; transition: all .15s; width: 100%; text-align: center; }
      .btn-add-row:hover { border-color: var(--dark); color: var(--dark); background: var(--white); }
      .dur-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .dur-editor-card { border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: var(--bg); }
      .dur-editor-card .dur-label-sm { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .3px; }
      .dur-editor-card .dur-input { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--white); width: 100%; box-sizing: border-box; outline: none; }
      .dur-editor-card .dur-input:focus { border-color: var(--dark); }
      .faq-editor-item { border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: var(--white); }
      .preview-col { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 12px; }
      .preview-card { background: var(--white); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
      .preview-card-header { padding: 11px 16px; border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; }
      .preview-card-body { padding: 16px; }
      .toggle-wrap { display: flex; align-items: center; gap: 10px; height: 38px; }
      .toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
      .toggle input { opacity: 0; width: 0; height: 0; }
      .toggle-slider { position: absolute; inset: 0; background: #E5E7EB; border-radius: 100px; transition: background .2s; cursor: pointer; }
      .toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
      .toggle input:checked + .toggle-slider { background: var(--orange); }
      .toggle input:checked + .toggle-slider::before { transform: translateX(18px); }
      .toggle-label { font-size: 13px; color: var(--dark); }
      .edit-page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
      .edit-breadcrumb { display: flex; align-items: center; gap: 8px; }
      .edit-breadcrumb a { font-size: 14px; color: var(--muted); cursor: pointer; text-decoration: none; transition: color .15s; }
      .edit-breadcrumb a:hover { color: var(--dark); }
      .edit-breadcrumb .bc-sep { color: var(--muted); }
      .edit-breadcrumb .bc-current { font-size: 14px; font-weight: 600; color: var(--dark); }
      .edit-page-actions { display: flex; gap: 8px; }
      .icon-picker-wrap { display: flex; align-items: center; gap: 12px; }
      .icon-preview { width: 48px; height: 48px; border-radius: 12px; background: #C8E6F5; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 2px solid var(--border); flex-shrink: 0; }
      .icon-grid { display: flex; gap: 6px; flex-wrap: wrap; }
      .icon-opt { width: 36px; height: 36px; border-radius: 9px; border: 2px solid var(--border); background: var(--bg); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s; }
      .icon-opt.selected, .icon-opt:hover { border-color: var(--dark); background: var(--white); }
      .admin-toast { position: fixed; bottom: 24px; right: 24px; background: var(--dark); color: #fff; font-size: 13px; font-weight: 600; padding: 12px 20px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.2); opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; pointer-events: none; z-index: 9999; }
      .admin-toast.show { opacity: 1; transform: translateY(0); }
      .checklist-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; }
      .checklist-dot { font-size: 10px; }

      @media (max-width: 1024px) {
        .metrics { grid-template-columns: repeat(2, 1fr); }
        .grid-2, .grid-2-eq, .edit-layout { grid-template-columns: 1fr; }
        .preview-col { position: static; }
      }

      @media (max-width: 768px) {
        .sidebar { display: none; }
        .admin-main {
          margin-left: 0;
          padding-bottom: max(10px, env(safe-area-inset-bottom));
        }

        .admin-desktop-only { display: none !important; }
        .admin-mobile-only { display: block; }
        .admin-mobile-nav { display: none !important; }

        .topbar {
          height: 52px;
          min-height: 52px;
          padding: 7px 10px;
          gap: 8px;
          backdrop-filter: saturate(140%) blur(8px);
        }
        .topbar-left { gap: 8px; }
        .topbar-left h1 { font-size: 14px; line-height: 1.2; }
        .topbar-left p { display: none; }
        .topbar-right { display: none; }
        .mobile-menu-btn { display: inline-flex; align-items: center; justify-content: center; }

        .page { padding: 10px; }

        .metrics {
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .metric-card {
          border-radius: 12px;
          padding: 12px;
        }
        .metric-top { margin-bottom: 8px; }
        .metric-icon { width: 28px; height: 28px; font-size: 14px; }
        .metric-label { font-size: 11px; }
        .metric-value { font-size: 18px; margin-bottom: 2px; }
        .metric-change { font-size: 11px; }

        .alert-bar {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          font-size: 12px;
          padding: 9px 10px;
          margin-bottom: 12px;
          border-radius: 12px;
        }

        .grid-2,
        .grid-2-eq {
          gap: 10px;
          margin-bottom: 10px;
        }

        .card { border-radius: 12px; }
        .card-header { padding: 10px 12px; }
        .card-header h2 { font-size: 13px; }
        .link-btn { font-size: 11px; }

        .chart-wrap { padding: 12px; }
        .chart-tabs { margin-bottom: 10px; }
        .chart-tab { font-size: 11px; padding: 4px 8px; }
        .chart-area { height: 132px; gap: 4px; }
        .mobile-chart-wrap { padding: 0; }
        .mobile-chart-area { height: 96px; }
        .mobile-chart-tabs .chart-tab { font-size: 10px; padding: 3px 7px; }
        .bar-label { font-size: 9px; }

        table { font-size: 12px; }
        th {
          font-size: 10px;
          padding: 8px 12px;
        }
        td {
          padding: 10px 12px;
        }
        .order-email { font-size: 11px; }
        .product-pill { font-size: 11px; padding: 2px 8px; }
        .status-badge { font-size: 10px; padding: 3px 8px; }
        .action-btn { font-size: 11px; padding: 4px 8px; }

        .stok-item,
        .garansi-item,
        .top-prod-item {
          padding: 8px 12px;
          gap: 10px;
        }
        .stok-icon { width: 30px; font-size: 20px; }
        .stok-name,
        .garansi-name,
        .top-prod-name { font-size: 12px; }
        .stok-meta,
        .garansi-detail,
        .top-prod-sales { font-size: 10px; }
        .stok-add-btn,
        .g-approve,
        .g-reject { font-size: 10px; padding: 4px 7px; }
        .garansi-avatar { width: 28px; height: 28px; font-size: 11px; }
        .top-prod-rev { font-size: 12px; }

        .mini-stats { padding: 12px; }
        .mini-stat { padding: 10px 0; }
        .mini-stat-label { font-size: 11px; }
        .mini-stat-value { font-size: 17px; }
        .mini-stat-sub { font-size: 10px; }

        .edit-page-header { margin-bottom: 12px; }
        .edit-page-actions { width: 100%; }
        .edit-page-actions .topbar-btn {
          flex: 1;
          justify-content: center;
          font-size: 11px;
          padding: 6px 8px;
        }

        .form-section-header { padding: 10px 12px; }
        .form-section-header h3 { font-size: 13px; }
        .form-section-sub { font-size: 10px; }
        .form-section-body { padding: 12px; gap: 10px; }
        .form-row-2,
        .form-row-3,
        .dur-editor-grid { grid-template-columns: 1fr; gap: 8px; }
        .spec-row { grid-template-columns: 1fr; gap: 6px; }
        .dynamic-row { align-items: stretch; }
        .dynamic-row .btn-remove-row { width: 30px; height: 32px; }
        .dur-editor-card,
        .faq-editor-item,
        .preview-card-body { padding: 10px; }
        .preview-card-header { padding: 9px 12px; }
        .icon-picker-wrap { flex-direction: column; align-items: flex-start; }
        .icon-preview { width: 42px; height: 42px; font-size: 20px; }
        .icon-opt { width: 32px; height: 32px; font-size: 16px; }
      }

      @media (max-width: 420px) {
        .topbar { padding: 7px 8px; }
        .topbar-left h1 { font-size: 13px; }
        .page { padding: 8px; }

        .mobile-fab {
          right: 10px;
          bottom: calc(12px + env(safe-area-inset-bottom));
          font-size: 11px;
          padding: 9px 12px;
        }
      }
    `}</style>
  )
}
