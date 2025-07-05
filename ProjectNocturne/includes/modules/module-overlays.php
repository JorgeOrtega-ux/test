<div class="module-overlay disabled">
    <?php include 'includes/menus/menu-paletteColors.php'; ?>
    <?php include 'includes/menus/menu-alarm.php'; ?>
    <?php include 'includes/menus/menu-timer.php'; ?>
    <?php include 'includes/menus/menu-worldClock.php'; ?>

    <div class="menu-sounds disabled body-title" data-menu="Sounds">
        <div class="pill-container">
            <div class="drag-handle"></div>
        </div>
        <div class="menu-section">
            <div class="menu-section-top">
                <div class="menu-content-header">
                    <div class="menu-content-header-secondary">
                        <button class="header-button" data-action="back-to-previous-menu">
                            <span class="material-symbols-rounded">arrow_back</span>
                        </button>
                    </div>
                    <div class="menu-content-header-primary">
                        <span class="material-symbols-rounded">music_note</span>
                        <span data-translate="alarm_sound" data-translate-category="alarms">Sonido</span>
                    </div>
                </div>
            </div>
            <div class="dropdown-menu-container dropdown-menu--structured" style="position: relative; height: 100%; filter: none; border: none;">
                <div class="dropdown-menu-top">
                    </div>
                <div class="dropdown-menu-bottom overflow-y">
                    <div class="menu-list sounds-list">
                        </div>
                </div>
            </div>
        </div>
    </div>

    <div class="menu-country disabled body-title" data-menu="Country">
        <div class="pill-container">
            <div class="drag-handle"></div>
        </div>
        <div class="menu-section">
            <div class="menu-section-top">
                <div class="search-content">
                    <div class="search-content-icon">
                        <span class="material-symbols-rounded">search</span>
                    </div>
                    <div class="search-content-text">
                        <input type="text" id="menu-country-search-input" class="body-title" autocomplete="off" 
                               data-translate="search_cities_placeholder" 
                               data-translate-category="search" 
                               data-translate-target="placeholder">
                    </div>
                </div>
            </div>
            <div class="menu-content-scrolleable overflow-y">
                <div class="menu-section-center">
                    <div class="menu-list country-list">
                        </div>
                </div>
            </div>
            <div class="menu-section-bottom">
                 <button class="header-button" data-action="back-to-previous-menu" style="width: 100%; border-radius: 8px;">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
            </div>
        </div>
    </div>

    <div class="menu-timezone disabled body-title" data-menu="Timezone">
        <div class="pill-container">
            <div class="drag-handle"></div>
        </div>
        <div class="menu-section">
            <div class="menu-section-top">
                <div class="menu-content-header">
                    <div class="menu-content-header-primary">
                        <span class="material-symbols-rounded">schedule</span>
                        <span data-translate="select_timezone" data-translate-category="world_clock">Selecciona una zona horaria</span>
                    </div>
                </div>
            </div>
            <div class="menu-content-scrolleable overflow-y">
                <div class="menu-section-center">
                    <div class="menu-list timezone-list">
                        </div>
                </div>
            </div>
            <div class="menu-section-bottom">
                 <button class="header-button" data-action="back-to-previous-menu" style="width: 100%; border-radius: 8px;">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
            </div>
        </div>
    </div>
</div>