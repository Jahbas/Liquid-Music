// Simple IndexedDB wrapper for storing audio blobs persistently
console.log('Script.js loaded successfully!');

class MusicDB {
    constructor() {
        this.db = null;
        this.fallbackStorage = new Map(); // In-memory fallback
        this.fallbackKeys = new Set(); // Track which files are in fallback
        this.indexedDBKeys = new Set(); // Track which files are in IndexedDB
    }

    async open() {
        return new Promise(async (resolve, reject) => {
            console.log('Opening database...');
            
            // Request persistent storage for more quota
            try {
                if ('storage' in navigator && 'persist' in navigator.storage) {
                    const isPersistent = await navigator.storage.persist();
                    console.log('Persistent storage granted:', isPersistent);
                    
                    // Get storage quota info
                    const estimate = await navigator.storage.estimate();
                    console.log('Storage quota:', Math.round(estimate.quota / 1024 / 1024), 'MB');
                    console.log('Storage used:', Math.round(estimate.usage / 1024 / 1024), 'MB');
                }
            } catch (e) {
                console.log('Could not request persistent storage:', e);
            }
            
            // Try to open existing database first
            this.createNewDatabase(resolve, reject);
        });
    }
    
    createNewDatabase(resolve, reject) {
            const request = indexedDB.open('musicPlayerDB', 1);
            request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tracks')) {
                console.log('Creating tracks object store');
                    db.createObjectStore('tracks', { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
            console.log('Database opened successfully');
                this.db = request.result;
                resolve();
            };
        request.onerror = () => {
            console.error('Database open error:', request.error);
            reject(request.error);
        };
    }

    saveFile(file) {
        console.log('=== saveFile method called ===');
        console.log('File:', file);
        console.log('Database:', this.db);
        return new Promise((resolve, reject) => {
            console.log('Saving file to database:', file.name, 'Size:', file.size);
            const id = 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            
            // Check if we're approaching IndexedDB limits
            if (this.indexedDBKeys.size >= 150) { // Conservative limit
                console.log('Approaching IndexedDB limit, using fallback storage');
                this.useFallbackStorage(id, file, resolve);
                return;
            }
            
            // Try IndexedDB first with a longer timeout
            if (this.db) {
                console.log('Attempting IndexedDB save...');
                const timeout = setTimeout(() => {
                    console.log('IndexedDB timeout, using fallback storage');
                    this.useFallbackStorage(id, file, resolve);
                }, 10000); // 10 second timeout for persistence
                
            const tx = this.db.transaction('tracks', 'readwrite');
            const store = tx.objectStore('tracks');
                const putRequest = store.put({ id, blob: file });
                
                putRequest.onsuccess = () => {
                    console.log('IndexedDB put request successful');
                };
                putRequest.onerror = (event) => {
                    console.log('IndexedDB put request failed:', event.target.error);
                    clearTimeout(timeout);
                    // Check if it's a quota error
                    if (event.target.error && event.target.error.name === 'QuotaExceededError') {
                        console.log('IndexedDB quota exceeded, switching to fallback for remaining files');
                        // Clear some old entries to make space
                        this.clearOldIndexedDBEntries();
                    }
                    this.useFallbackStorage(id, file, resolve);
                };
                
                tx.oncomplete = () => {
                    console.log('IndexedDB transaction completed successfully');
                    this.indexedDBKeys.add(id);
                    console.log('File successfully saved to IndexedDB:', id);
                    
                    // Test if the file can actually be retrieved (verify persistence)
                    setTimeout(() => {
                        this.testFilePersistence(id);
                    }, 100);
                    
                    clearTimeout(timeout);
                    resolve(id);
                };
                tx.onerror = () => {
                    console.log('IndexedDB transaction failed, using fallback');
                    clearTimeout(timeout);
                    this.useFallbackStorage(id, file, resolve);
                };
                tx.onabort = () => {
                    console.log('IndexedDB transaction aborted, using fallback');
                    clearTimeout(timeout);
                    this.useFallbackStorage(id, file, resolve);
                };
            } else {
                console.log('IndexedDB not available, using fallback storage');
                this.useFallbackStorage(id, file, resolve);
            }
        });
    }
    
    getTotalStoredCount() {
        // Count total stored files (both IndexedDB and fallback)
        return this.indexedDBKeys.size + this.fallbackKeys.size;
    }
    
    getPersistentCount() {
        // Count files stored in IndexedDB (persistent)
        return this.indexedDBKeys.size;
    }
    
    getTemporaryCount() {
        // Count files stored in fallback (temporary)
        return this.fallbackKeys.size;
    }
    
    clearOldLocalStorageEntries() {
        console.log('Clearing old localStorage entries to make space...');
        const keys = Object.keys(localStorage);
        const trackKeys = keys.filter(key => key.startsWith('track_'));
        
        // Remove oldest 50% of tracks to make space
        const toRemove = trackKeys.slice(0, Math.floor(trackKeys.length / 2));
        toRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        console.log(`Cleared ${toRemove.length} old localStorage entries`);
    }
    
    async clearOldIndexedDBEntries() {
        if (!this.db) return;
        
        console.log('Clearing old IndexedDB entries to make space...');
        try {
            const tx = this.db.transaction('tracks', 'readwrite');
            const store = tx.objectStore('tracks');
            
            // Get all keys and remove the oldest 25%
            const getAllKeysRequest = store.getAllKeys();
            getAllKeysRequest.onsuccess = () => {
                const keys = getAllKeysRequest.result;
                const toRemove = keys.slice(0, Math.floor(keys.length * 0.25));
                
                toRemove.forEach(key => {
                    store.delete(key);
                    this.indexedDBKeys.delete(key);
                });
                
                console.log(`Cleared ${toRemove.length} old IndexedDB entries`);
            };
        } catch (error) {
            console.log('Error clearing IndexedDB entries:', error);
        }
    }
    
    async testFilePersistence(id) {
        try {
            const blob = await this.getFile(id);
            if (blob) {
                console.log('✅ File persistence test PASSED for:', id);
            } else {
                console.log('❌ File persistence test FAILED for:', id);
                // Remove from persistent count if it can't be retrieved
                this.indexedDBKeys.delete(id);
            }
        } catch (e) {
            console.log('❌ File persistence test ERROR for:', id, e);
            this.indexedDBKeys.delete(id);
        }
    }
    
    // Method to clear database (for debugging only)
    async clearDatabase() {
        console.log('Clearing database...');
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase('musicPlayerDB');
            deleteRequest.onsuccess = () => {
                console.log('Database cleared successfully');
                this.indexedDBKeys.clear();
                this.fallbackKeys.clear();
                this.fallbackStorage.clear();
                resolve();
            };
            deleteRequest.onerror = () => {
                console.log('Failed to clear database:', deleteRequest.error);
                reject(deleteRequest.error);
            };
        });
    }
    
    useFallbackStorage(id, file, resolve) {
        console.log('Using fallback storage with ID:', id);
        this.fallbackStorage.set(id, file);
        this.fallbackKeys.add(id);
        console.log('File saved with ID:', id);
        console.log('Fallback storage count:', this.fallbackKeys.size);
        console.log('IndexedDB storage count:', this.indexedDBKeys.size);
        
        // Try to save to localStorage for persistence (with quota management)
        if (file.size < 5 * 1024 * 1024) { // 5MB limit for localStorage
            try {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        localStorage.setItem(`track_${id}`, reader.result);
                        console.log('File also saved to localStorage for persistence');
                    } catch (e) {
                        console.log('localStorage save failed (quota exceeded)');
                        // Clear old localStorage entries to make space
                        this.clearOldLocalStorageEntries();
                    }
                };
                reader.readAsDataURL(file);
            } catch (e) {
                console.log('localStorage save failed:', e);
            }
        }
        
        // Show warning to user (only once to avoid spam)
        if (window.musicPlayer && this.fallbackKeys.size === 1) {
            window.musicPlayer.showNotification('IndexedDB limit reached - new files will be temporary', 'fa-exclamation-triangle');
        }
        
        resolve(id);
    }

    getFile(id) {
        return new Promise((resolve, reject) => {
            console.log('getFile called for ID:', id);
            console.log('Fallback keys:', Array.from(this.fallbackKeys));
            console.log('IndexedDB keys:', Array.from(this.indexedDBKeys));
            
            // Check fallback storage first
            if (this.fallbackKeys.has(id)) {
                console.log('Getting file from fallback storage:', id);
                const file = this.fallbackStorage.get(id);
                console.log('Fallback file found:', file ? 'YES' : 'NO', 'Size:', file ? file.size : 'N/A');
                resolve(file || null);
                return;
            }
            
            // Check localStorage for persistence
            try {
                const localStorageData = localStorage.getItem(`track_${id}`);
                if (localStorageData) {
                    console.log('Getting file from localStorage:', id);
                    // Convert data URL back to blob
                    const response = fetch(localStorageData);
                    response.then(res => res.blob()).then(blob => {
                        console.log('localStorage blob retrieved, size:', blob.size);
                        resolve(blob);
                    }).catch(error => {
                        console.log('localStorage blob conversion failed:', error);
                        resolve(null);
                    });
                    return;
                }
            } catch (e) {
                console.log('localStorage retrieval failed:', e);
            }
            
            // Try IndexedDB
            if (this.db) {
                console.log('Trying IndexedDB for ID:', id);
            const tx = this.db.transaction('tracks', 'readonly');
            const store = tx.objectStore('tracks');
            const req = store.get(id);
                req.onsuccess = () => {
                    const result = req.result?.blob || null;
                    console.log('IndexedDB result for ID:', id, 'Found:', result ? 'YES' : 'NO', 'Size:', result ? result.size : 'N/A');
                    resolve(result);
                };
                req.onerror = () => {
                    console.log('IndexedDB error for ID:', id, req.error);
                    reject(req.error);
                };
            } else {
                console.log('IndexedDB not available for ID:', id);
                resolve(null);
            }
        });
    }

    async getObjectUrl(id) {
        console.log('Getting object URL for ID:', id);
        const blob = await this.getFile(id);
        console.log('Retrieved blob for ID:', id, 'Blob size:', blob ? blob.size : 'null');
        return blob ? URL.createObjectURL(blob) : null;
    }

    deleteFile(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tracks', 'readwrite');
            const store = tx.objectStore('tracks');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

class MusicPlayer {
    constructor(db) {
        this.audio = new Audio();
        this.playlist = [];
        this.customPlaylists = new Map();
        this.currentPlaylistId = 'current';
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isShuffled = false;
        this.repeatMode = 'none'; // 'none', 'one', 'all'
        this.volume = 0.7;
        this.isDraggingVolume = false;
        this.isDraggingProgress = false;
        this.selectedTracks = new Set(); // Track indices of selected songs
        this.isMultiSelecting = false;
        this.isDragging = false; // whether a native drag is in progress
        this.confirmDialogCallback = null; // Callback function for confirmation dialog
        this.dragStartIndex = null; // index of the item where drag began
        this.stackModeActive = false; // user pressed Ctrl during drag to stack
        this.db = db;

        // Action log storage
        this.actionLog = [];

        this.initializeElements();
        this.bindEvents();
        this.setupAudio();
        this.loadFromStorage();
        this.loadSettings();
        this.loadDefaultVolume();
        this.updateStorageStatus();
        
        // Set default theme if none is loaded
        if (!document.body.getAttribute('data-theme')) {
            document.body.setAttribute('data-theme', 'glass');
        }

        // Trigger version check on load to show top-right banner immediately
        this.runVersionCheck(false);
    }

    initializeElements() {
        // Audio element
        this.audioElement = this.audio;
        
        // UI Elements
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.volumeBtn = document.getElementById('volumeBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.newPlaylistBtn = document.getElementById('newPlaylistBtn');
        
        // Confirmation dialog elements
        this.confirmDialogOverlay = document.getElementById('confirmDialogOverlay');
        this.confirmDialogMessage = document.getElementById('confirmDialogMessage');
        this.confirmDialogCancel = document.getElementById('confirmDialogCancel');
        this.confirmDialogConfirm = document.getElementById('confirmDialogConfirm');
        
        // Storage status elements
        this.storageInfo = document.getElementById('storageInfo');
        // this.clearOldStorageBtn = document.getElementById('clearOldStorageBtn'); // Removed from UI
        this.openMusicFolderBtn = document.getElementById('openMusicFolderBtn');
        this.scanMusicFolderBtn = document.getElementById('scanMusicFolderBtn');
        
        // Progress elements
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.progressHandle = document.getElementById('progressHandle');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        
        // Volume elements
        this.volumeContainer = document.querySelector('.volume-container');
        this.volumeBar = document.getElementById('volumeBar');
        this.volumeProgress = document.getElementById('volumeProgress');
        this.volumeHandle = document.getElementById('volumeHandle');
        this.volumePercentageEl = document.getElementById('volumePercentage');
        
        // Track info elements
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        this.albumArt = document.getElementById('albumArt');
        this.muteIndicator = document.getElementById('muteIndicator');
        
        // Playlist elements
        this.playlistEl = document.getElementById('playlist');
        this.playlistTabs = document.getElementById('playlistTabs');
        this.fileInput = document.getElementById('fileInput');
        this.folderInput = document.getElementById('folderInput');
        console.log('File input element:', this.fileInput);
        console.log('Folder input element:', this.folderInput);
        this.playerCard = document.querySelector('.player');
        this.playerMaxBtn = document.getElementById('playerMaxBtn');
        
        // Modal elements
        this.playlistModal = document.getElementById('playlistModal');
        this.playlistName = document.getElementById('playlistName');
        this.playlistCover = document.getElementById('playlistCover');
        this.coverUpload = document.getElementById('coverUpload');
        this.coverPreview = document.getElementById('coverPreview');
        this.coverImage = document.getElementById('coverImage');
        this.removeCover = document.getElementById('removeCover');
        this.modalClose = document.getElementById('modalClose');
        this.cancelPlaylist = document.getElementById('cancelPlaylist');
        this.createPlaylist = document.getElementById('createPlaylist');
        
        // Settings elements
        this.settingsPanel = document.getElementById('settingsPanel');
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsContent = document.getElementById('settingsContent');
        this.settingsClose = document.getElementById('settingsClose');
        this.performanceMode = document.getElementById('performanceMode');
        this.glassEffects = document.getElementById('glassEffects');
        this.animatedBg = document.getElementById('animatedBg');
        this.disableHover = document.getElementById('disableHover');
        this.thickSongs = document.getElementById('thickSongs');
        this.themeButtons = document.querySelectorAll('.theme-btn');
        this.currentTheme = 'dark';
        this.versionStatus = document.getElementById('versionStatus');
        this.checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
        
        // Default volume elements
        this.defaultVolumeSlider = document.getElementById('defaultVolume');
        this.defaultVolumeInput = document.getElementById('defaultVolumeInput');

        // Artists UI elements
        this.artistsToggle = document.getElementById('artistsToggle');
        this.artistsModal = document.getElementById('artistsModal');
        this.artistsClose = document.getElementById('artistsClose');
        this.artistsList = document.getElementById('artistsList');
        this.collapseToggle = document.getElementById('collapseToggle');

        // Logs UI elements
        this.logsToggle = document.getElementById('logsToggle');
        this.logsModal = document.getElementById('logsModal');
        this.logsClose = document.getElementById('logsClose');
        this.logsClear = document.getElementById('logsClear');
        this.logsList = document.getElementById('logsList');

        // Discord button
        this.discordBtn = document.querySelector('.discord-btn');

        // Drag & drop overlay
        this.dropOverlay = document.getElementById('dropOverlay');
        
        // Confirmation modal elements
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmCancel = document.getElementById('confirmCancel');
        this.confirmOk = document.getElementById('confirmOk');
    }

    bindEvents() {
        // Control buttons
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.previousTrack());
        this.nextBtn.addEventListener('click', () => this.nextTrack());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.clearBtn.addEventListener('click', () => this.clearPlaylist());
        this.newPlaylistBtn.addEventListener('click', () => this.showPlaylistModal());
        // this.clearOldStorageBtn.addEventListener('click', () => this.clearOldStorage()); // Removed from UI
        this.openMusicFolderBtn.addEventListener('click', () => this.openMusicFolder());
        this.scanMusicFolderBtn.addEventListener('click', () => this.scanMusicFolder());
        
        // Confirmation dialog events
        this.confirmDialogCancel.addEventListener('click', () => this.hideConfirmDialog());
        this.confirmDialogConfirm.addEventListener('click', () => this.executeConfirmDialogCallback());
        this.confirmDialogOverlay.addEventListener('click', (e) => {
            if (e.target === this.confirmDialogOverlay) {
                this.hideConfirmDialog();
            }
        });
        
        // Progress bar
        this.progressBar.addEventListener('click', (e) => this.seekTo(e));
        this.progressBar.addEventListener('mousedown', (e) => this.startProgressDrag(e));
        this.progressHandle.addEventListener('mousedown', (e) => this.startProgressDrag(e));
        
        // Volume control
        this.volumeBar.addEventListener('click', (e) => this.setVolume(e));
        this.volumeBar.addEventListener('mousedown', (e) => this.startVolumeDrag(e));
        this.volumeHandle.addEventListener('mousedown', (e) => this.startVolumeDrag(e));
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        
        // File upload
        console.log('Setting up file upload event listeners...');
        this.fileInput.addEventListener('change', (e) => {
            console.log('File input change event triggered!');
            console.log('Files selected:', e.target.files.length);
            console.log('Files:', Array.from(e.target.files).map(f => f.name));
            this.handleFileUpload(e);
        });
        this.folderInput.addEventListener('change', (e) => {
            console.log('Folder input change event triggered!');
            this.handleFolderUpload(e);
        });
        
        // Modal events
        this.modalClose.addEventListener('click', () => this.hidePlaylistModal());
        this.cancelPlaylist.addEventListener('click', () => this.hidePlaylistModal());
        this.createPlaylist.addEventListener('click', () => this.createNewPlaylist());
        this.coverUpload.addEventListener('click', () => this.playlistCover.click());
        this.playlistCover.addEventListener('change', (e) => this.handleCoverUpload(e));
        this.removeCover.addEventListener('click', () => this.removeCoverImage());
        
        // Global mouse events for dragging
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.handleTrackEnd());
        this.audio.addEventListener('error', (e) => this.handleAudioError(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Stack mode: allow entering multi-select while dragging by holding Ctrl/Cmd
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Control' || e.metaKey) && this.isDragging) {
                this.stackModeActive = true;
                if (this.dragStartIndex != null) {
                    this.selectedTracks.add(this.dragStartIndex);
                    this.renderPlaylist();
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && !e.ctrlKey) {
                this.stackModeActive = false;
            }
        });
        
        // Clear selection when clicking outside playlist items (not during drag)
        document.addEventListener('click', (e) => {
            if (this.isDragging) return;
            if (!e.target.closest('.playlist-item') && !e.target.closest('.playlist-tab')) {
                this.clearSelection();
                this.renderPlaylist();
            }
        });
        
        // Modal overlay click to close
        this.playlistModal.addEventListener('click', (e) => {
            if (e.target === this.playlistModal) {
                this.hidePlaylistModal();
            }
        });
        
        // Settings events
        this.settingsToggle.addEventListener('click', () => this.toggleSettings());
        this.settingsClose.addEventListener('click', () => this.hideSettings());
        this.performanceMode.addEventListener('change', () => this.togglePerformanceMode());
        this.glassEffects.addEventListener('change', () => this.toggleGlassEffects());
        this.animatedBg.addEventListener('change', () => this.toggleAnimatedBackground());
        this.disableHover.addEventListener('change', () => this.applyHoverEffectsSetting());
        this.thickSongs.addEventListener('change', () => this.toggleThickSongs());
        if (this.checkUpdatesBtn) {
            this.checkUpdatesBtn.addEventListener('click', () => this.runVersionCheck(true));
        }
        
        // Default volume events
        this.defaultVolumeSlider.addEventListener('input', () => this.updateDefaultVolumeFromSlider());
        this.defaultVolumeInput.addEventListener('input', () => this.updateDefaultVolumeFromInput());
        this.defaultVolumeInput.addEventListener('blur', () => this.validateVolumeInput());
        
        // Theme events
        this.themeButtons.forEach(button => {
            button.addEventListener('click', () => this.changeTheme(button.dataset.theme));
        });
        
        // Settings panel overlay click to close
        this.settingsContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        this.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) {
                this.hideSettings();
            }
        });

        // Artists events
        this.artistsToggle.addEventListener('click', () => this.showArtists());
        this.artistsClose.addEventListener('click', () => this.hideArtists());
        this.artistsModal.addEventListener('click', (e) => {
            if (e.target === this.artistsModal) this.hideArtists();
        });

        // Collapse button
        this.collapseToggle.addEventListener('click', () => this.toggleBottomPanels());

        // Logs events
        this.logsToggle.addEventListener('click', () => this.showLogs());
        this.logsClose.addEventListener('click', () => this.hideLogs());
        this.logsModal.addEventListener('click', (e) => {
            if (e.target === this.logsModal) this.hideLogs();
        });
        this.logsClear.addEventListener('click', () => this.showClearLogsConfirm());


        // Discord confirmation
        if (this.discordBtn) {
            this.discordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.pendingDiscordUrl = this.discordBtn.getAttribute('href');
                this.showConfirmModal('Do you want to connect with our community?', 'joinDiscord');
            });
        }

        // Custom tooltip system
        this.initCustomTooltips();

        // Global drag & drop for files/folders
        this.bindDragAndDrop();


        // Global paste (copy files from Explorer, paste into the page)
        document.addEventListener('paste', async (e) => {
            try {
                const cd = e.clipboardData || window.clipboardData;
                if (!cd) return;
                const items = cd.items ? Array.from(cd.items) : [];
                const filesList = cd.files ? Array.from(cd.files) : [];

                // Collect files from both sources, then dedupe while preserving order preference: filesList first, then items
                const collected = [];
                const seen = new Set();
                const pushIfNew = (f) => {
                    if (!f) return;
                    const key = `${f.name}|${f.size}|${f.lastModified || 0}`;
                    if (!seen.has(key)) { seen.add(key); collected.push(f); }
                };

                // Some browsers expose multiple files only in cd.files
                filesList.forEach(pushIfNew);
                // Others expose in cd.items (and sometimes only the first in cd.files)
                items.forEach((it) => {
                    if (it.kind === 'file' && it.getAsFile) pushIfNew(it.getAsFile());
                });

                let audioFiles = collected.filter(f => this.isProbablyAudioFile(f));

                // Fallback: some browsers expose only one file via clipboardData; try Async Clipboard API
                if (audioFiles.length <= 1 && navigator.clipboard && navigator.clipboard.read) {
                    try {
                        const clipboardItems = await navigator.clipboard.read();
                        const extra = [];
                        for (const item of clipboardItems) {
                            // Gather any audio blobs from the clipboard items
                            for (const type of item.types) {
                                if (type && type.startsWith('audio/')) {
                                    const blob = await item.getType(type);
                                    // Synthesize a File with a generic name if filename is unavailable
                                    const fname = `Pasted Audio.${(type.split('/')[1] || 'bin')}`;
                                    extra.push(new File([blob], fname, { type }));
                                }
                            }
                        }
                        if (extra.length) {
                            // Merge and dedupe again
                            extra.forEach(f => {
                                const key = `${f.name}|${f.size}|${f.lastModified || 0}`;
                                if (!seen.has(key)) { seen.add(key); audioFiles.push(f); }
                            });
                        }
                    } catch (_) {
                        // ignore, will proceed with what we have
                    }
                }

                if (audioFiles.length) {
                    e.preventDefault();
                    this.showNotification(`Processing ${audioFiles.length} file${audioFiles.length>1?'s':''}...`, 'fa-spinner fa-spin');
                    // Preserve order at the top: insert from last to first
                    for (let i = audioFiles.length - 1; i >= 0; i--) {
                        await this.addTrackToPlaylist(audioFiles[i], true);
                    }
                    this.showNotification(`Pasted ${audioFiles.length} file${audioFiles.length>1?'s':''} to top of queue`, 'fa-paste');
                } else {
                    // Inform user about browser limitations if nothing was processed
                    this.showNotification('Your browser only pasted 1 file. Use drag & drop for multiple files.', 'fa-info-circle');
                }
            } catch (_) {
                // no-op
            }
        });
        
        // Confirmation modal events
        this.confirmCancel.addEventListener('click', () => this.hideConfirmModal());
        this.confirmOk.addEventListener('click', () => this.handleConfirmOk());
        this.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.confirmModal) this.hideConfirmModal();
        });

        // Maximize button
        if (this.playerMaxBtn) {
            this.playerMaxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlayerMaximize();
                // Toggle icon between expand/compress
                const icon = this.playerMaxBtn.querySelector('i');
                if (this.playerCard?.classList.contains('maximized')) {
                    icon.classList.remove('fa-expand');
                    icon.classList.add('fa-compress');
                } else {
                    icon.classList.remove('fa-compress');
                    icon.classList.add('fa-expand');
                }
            });
        }
    }

    setupAudio() {
        this.audio.volume = this.volume;
        this.audio.preload = 'metadata';
    }

    async handleFileUpload(event) {
        console.log('File upload started');
        const files = Array.from(event.target.files);
        console.log('Selected files:', files.length);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                console.log('Processing audio file:', file.name, 'Type:', file.type, 'Size:', file.size);
                this.showNotification(`Processing ${file.name}...`, 'fa-spinner fa-spin');
                try {
                    await this.addTrackToPlaylist(file);
                    console.log('Successfully added track:', file.name);
                    successCount++;
                    this.showNotification(`Added ${file.name}`, 'fa-check-circle');
                } catch (error) {
                    console.error('Error adding track:', file.name, error);
                    failCount++;
                    this.showNotification(`Failed to add ${file.name}`, 'fa-exclamation-triangle');
                }
            } else {
                console.log('Skipping non-audio file:', file.name, 'Type:', file.type);
            }
        }
        
        // Show summary
        console.log(`Upload complete: ${successCount} successful, ${failCount} failed`);
        if (successCount > 0) {
            this.showNotification(`Added ${successCount} files successfully`, 'fa-check-circle');
        }
        if (failCount > 0) {
            this.showNotification(`Failed to add ${failCount} files`, 'fa-exclamation-triangle');
        }
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
    }

    async handleFolderUpload(event) {
        console.log('Folder upload started');
        const files = Array.from(event.target.files);
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        console.log('Selected files:', files.length, 'Audio files:', audioFiles.length);
        
        if (audioFiles.length === 0) {
            console.log('No audio files found in folder');
            this.showNotification('No audio files found in folder', 'fa-exclamation-triangle');
            return;
        }
        
        this.showNotification(`Processing ${audioFiles.length} files...`, 'fa-spinner fa-spin');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const file of audioFiles) {
            try {
            await this.addTrackToPlaylist(file);
                successCount++;
            } catch (error) {
                console.error('Error adding track:', error);
                failCount++;
            }
        }
        
        // Show summary
        if (successCount > 0) {
            this.showNotification(`Added ${successCount} files successfully`, 'fa-check-circle');
        }
        if (failCount > 0) {
            this.showNotification(`Failed to add ${failCount} files`, 'fa-exclamation-triangle');
        }
        
        // Clear the input
        event.target.value = '';
    }

    async addTrackToPlaylist(file, addToTop = false) {
        console.log('Starting to add track:', file.name, 'Size:', file.size, 'Type:', file.type);
        console.log('Database object:', this.db);
        console.log('Database is null?', this.db === null);
        let id;
        try {
            console.log('About to call saveFile...');
            id = await this.db.saveFile(file);
            console.log('File saved with ID:', id);
        } catch (error) {
            console.error('Failed to save file to database:', file.name, error);
            throw error;
        }
        
        // Extract metadata from the file
        let metadata = {
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            title: file.name.replace(/\.[^/.]+$/, ""),
            year: null,
            genre: null
        };

        // Try to extract metadata from filename first (fallback)
        const filename = file.name.replace(/\.[^/.]+$/, "");
        const filenameParts = filename.split(' - ');
        if (filenameParts.length >= 2) {
            metadata.artist = filenameParts[0].trim();
            metadata.title = filenameParts[1].trim();
        }

        // Try to extract metadata using Python backend
        try {
            const extractedMetadata = await this.extractMetadataFromPython(file);
            
            if (extractedMetadata && Object.keys(extractedMetadata).length > 0) {
                metadata.artist = extractedMetadata.artist || metadata.artist;
                metadata.album = extractedMetadata.album || metadata.album;
                metadata.title = extractedMetadata.title || metadata.title;
                metadata.year = extractedMetadata.year || null;
                metadata.genre = extractedMetadata.genre || null;
                metadata.album_art = extractedMetadata.album_art || null;
                metadata.album_art_mime = extractedMetadata.album_art_mime || null;
            }
        } catch (error) {
            console.warn('Metadata extraction failed, using filename fallback:', error);
        }
        
        const track = {
            id: id,
            name: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year,
            genre: metadata.genre,
            url: null, // Will be set when needed
            duration: 0,
            album_art: metadata.album_art,
            album_art_mime: metadata.album_art_mime
        };

        if (addToTop) {
            this.playlist.unshift(track);
            console.log('Added track to top of playlist:', track.name);
        } else {
            this.playlist.push(track);
            console.log('Added track to end of playlist:', track.name);
        }
        console.log('Playlist length after adding:', this.playlist.length);
        
        // Set URL immediately for playback (only if not already set for local files)
        if (!track.url) {
            console.log('Setting URL for track:', track.name, 'ID:', track.id);
            track.url = await this.db.getObjectUrl(track.id);
            console.log('URL set for track:', track.name, 'URL:', track.url);
        } else {
            console.log('Track already has URL:', track.name, 'URL:', track.url);
        }
        
        console.log('Rendering playlist, current length:', this.playlist.length);
        this.renderPlaylist();
        this.saveToStorage();
        console.log('Track added to playlist successfully:', track.name);

        // Preload duration metadata so it shows without needing to play
        this.preloadTrackMetadata(track).catch(() => {});

        this.pushAction('track_add', { targetId: 'current', targetLabel: 'Queue', tracks: [{ id: track.id, name: track.name }], count: 1 }, true);

        if (this.playlist.length === 1) {
            this.loadTrack(0);
        }
        
        // Update storage status
        this.updateStorageStatus();
    }

    renderPlaylist() {
        const currentPlaylist = this.getCurrentPlaylist();
        console.log('Rendering playlist, length:', currentPlaylist.length);
        
        if (currentPlaylist.length === 0) {
            console.log('Playlist is empty, showing empty message');
            this.playlistEl.innerHTML = `
                <div class="playlist-empty">
                    <i class="fas fa-music"></i>
                    <p>No tracks in playlist</p>
                    <p>Upload some music to get started</p>
                </div>
            `;
            return;
        }

        this.playlistEl.innerHTML = currentPlaylist.map((track, index) => {
            const isSelected = this.selectedTracks.has(index);
            return `
            <div class="playlist-item ${index === this.currentTrackIndex ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
                 data-index="${index}">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${track.name || 'Unknown Title'}</div>
                    <div class="playlist-item-artist">${track.artist || 'Unknown Artist'}</div>
                </div>
                <div class="playlist-item-duration">${this.formatTime(track.duration)}</div>
                <button class="playlist-item-remove" onclick="musicPlayer.removeTrack(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        }).join('');

        // Add click and drag events to playlist items
        this.playlistEl.querySelectorAll('.playlist-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-item-remove')) {
                    if (e.ctrlKey || e.metaKey || this.stackModeActive) {
                        // Multi-select mode
                        this.toggleTrackSelection(index);
                        this.isMultiSelecting = true;
                        this.renderPlaylist(); // Re-render to show selection state
                    } else {
                        // Single selection - clear others and play (don't show selection state)
                        this.clearSelection();
                        const maybePromise = this.loadTrack(index);
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            maybePromise.then(() => this.play());
                        } else {
                            this.play();
                        }
                        this.isMultiSelecting = false;
                        // Don't re-render here to avoid showing selection state for single clicks
                    }
                }
            });

            // Enable drag from any playlist (move into target playlist/tab)
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                try {
                    this.isDragging = true;
                    this.dragStartIndex = index;
                    // If Ctrl is already held at drag start, activate stack mode and include this item
                    if (e.ctrlKey || e.metaKey) {
                        this.stackModeActive = true;
                        this.selectedTracks.add(index);
                    }
                    // If this item is selected and we have multiple selections, drag all selected
                    const selectedTracks = this.getSelectedTracks();
                    const isDraggingMultiple = selectedTracks.length > 1 && this.selectedTracks.has(index);
                    
                    let payload;
                    if (isDraggingMultiple) {
                        // Drag all selected tracks
                        payload = { 
                            indices: selectedTracks.map(st => st.index), 
                            source: this.currentPlaylistId,
                            multiple: true
                        };
                    } else {
                        // Drag single track
                        payload = { 
                            index, 
                            source: this.currentPlaylistId,
                            multiple: false
                        };
                    }
                    
                    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'move';
                    
                    // Custom liquid glass drag image
                    const dragGhost = document.createElement('div');
                    dragGhost.className = 'glass-card';
                    dragGhost.style.cssText = `
                        position: fixed; top: -9999px; left: -9999px; padding: 10px 14px; border-radius: 14px;
                        background: rgba(255,255,255,0.12); backdrop-filter: blur(18px);
                        border: 1px solid rgba(255,255,255,0.25); color: #fff; font: 500 12px 'Inter', sans-serif;
                        box-shadow: 0 10px 28px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.15);
                    `;
                    
                    if (isDraggingMultiple) {
                        dragGhost.textContent = `${selectedTracks.length} tracks`;
                    } else {
                        dragGhost.textContent = currentPlaylist[index]?.name || 'Track';
                    }
                    
                    document.body.appendChild(dragGhost);
                    e.dataTransfer.setDragImage(dragGhost, dragGhost.offsetWidth / 2, dragGhost.offsetHeight / 2);
                    // Cleanup after a tick
                    setTimeout(() => dragGhost.remove(), 0);
                } catch (_) {}
            });
            item.addEventListener('dragend', () => {
                // End of drag life-cycle
                this.isDragging = false;
                this.dragStartIndex = null;
                // Do not clear selection here; drop handler or outside click will handle
                // If user was stacking but didn't drop anywhere, keep the selection intact
                this.stackModeActive = false;
            });
        });
    }

    renderPlaylistTabs() {
        const tabs = [
            {
                id: 'current',
                name: 'Current Queue',
                icon: 'fa-play',
                cover: null
            }
        ];

        // Add custom playlists
        this.customPlaylists.forEach((playlist, id) => {
            tabs.push({
                id: id,
                name: playlist.name,
                icon: 'fa-list',
                cover: playlist.cover
            });
        });

        this.playlistTabs.innerHTML = tabs.map(tab => `
            <div class="playlist-tab ${tab.id === this.currentPlaylistId ? 'active' : ''}" 
                 data-playlist="${tab.id}">
                ${tab.cover ? `<img src="${tab.cover}" class="playlist-tab-cover" alt="Cover">` : `<i class="fas ${tab.icon}"></i>`}
                <span>${tab.name}</span>
                ${tab.id !== 'current' ? `<button class="playlist-tab-remove" onclick="musicPlayer.deletePlaylist('${tab.id}')"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `).join('');

        // Add click events to tabs
        this.playlistTabs.querySelectorAll('.playlist-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-tab-remove')) {
                    const playlistId = tab.dataset.playlist;
                    this.switchPlaylist(playlistId);
                }
            });

            // Double-click to play the playlist immediately
            tab.addEventListener('dblclick', (e) => {
                if (e.target.closest('.playlist-tab-remove')) return;
                const playlistId = tab.dataset.playlist;
                this.switchPlaylist(playlistId);
                const list = this.getCurrentPlaylist();
                if (list.length > 0) {
                    const maybe = this.loadTrack(0);
                    const tryImmediatePlay = () => {
                        // Try to play right away
                        const p = this.audio.play();
                        if (p && typeof p.then === 'function') {
                            p.catch(() => {
                                // If it couldn't start immediately, retry on canplay once
                                const onCanPlay = () => {
                                    this.audio.removeEventListener('canplay', onCanPlay);
                                    this.audio.play().catch(() => {});
                                };
                                this.audio.addEventListener('canplay', onCanPlay);
                            });
                        }
                        this.isPlaying = true;
                        this.updatePlayButton();
                        this.albumArt.classList.add('loading');
                    };
                    if (maybe && typeof maybe.then === 'function') {
                        maybe.then(tryImmediatePlay);
                    } else {
                        tryImmediatePlay();
                    }
                }
            });

            // Allow drop of tracks from any playlist onto any tab (move semantics)
            const playlistId = tab.dataset.playlist;
            tab.addEventListener('dragover', (e) => {
                e.preventDefault();
                tab.classList.add('drag-over');
            });
            tab.addEventListener('dragleave', () => {
                tab.classList.remove('drag-over');
            });
            tab.addEventListener('drop', (e) => {
                e.preventDefault();
                try {
                    const data = e.dataTransfer.getData('text/plain');
                    const payload = JSON.parse(data);
                    if (!payload || !payload.source) return;
                    const sourceId = payload.source;
                    // Ignore dropping into the same playlist
                    if (sourceId === playlistId) return;
                    
                    if (payload.multiple && payload.indices) {
                        // Move multiple tracks
                        this.moveMultipleTracksBetweenPlaylists(sourceId, payload.indices, playlistId);
                    } else if (typeof payload.index === 'number') {
                        // Move single track
                        this.moveTrackBetweenPlaylists(sourceId, payload.index, playlistId);
                    }
                    
                    // Clear selection after successful move
                    this.clearSelection();
                    this.renderPlaylist();
                    
                    // Visual ripple feedback
                    const ripple = document.createElement('span');
                    ripple.className = 'drop-ripple';
                    tab.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 650);
                } catch (_) {
                    // no-op
                }
                tab.classList.remove('drag-over');
            });
        });
    }

    getPlaylistArrayById(playlistId) {
        if (playlistId === 'current') return this.playlist;
        return this.customPlaylists.get(playlistId)?.tracks || null;
    }

    moveTrackBetweenPlaylists(sourceId, sourceIndex, targetId) {
        const sourceArr = this.getPlaylistArrayById(sourceId);
        const targetArr = this.getPlaylistArrayById(targetId) || (this.customPlaylists.get(targetId)?.tracks);
        if (!sourceArr || !targetArr) return;
        if (sourceIndex < 0 || sourceIndex >= sourceArr.length) return;

        const [track] = sourceArr.splice(sourceIndex, 1);
        if (!track) return;
        // Insert at front when moving into Current Queue, otherwise append
        if (targetId === 'current') {
            targetArr.unshift(track);
        } else {
            targetArr.push(track);
        }

        // Adjust current track index and playback if we moved from the currently viewed playlist
        if (this.currentPlaylistId === sourceId) {
            if (sourceIndex < this.currentTrackIndex) {
                this.currentTrackIndex--;
            } else if (sourceIndex === this.currentTrackIndex) {
                const list = this.getCurrentPlaylist();
                if (list.length === 0) {
                    this.stop();
                } else {
                    this.currentTrackIndex = Math.min(this.currentTrackIndex, list.length - 1);
                    this.loadTrack(this.currentTrackIndex);
                    if (this.isPlaying) this.play();
                }
            }
        }

        // If we inserted at the front of the currently viewed playlist,
        // shift currentTrackIndex to keep the same song highlighted/playing
        if (this.currentPlaylistId === targetId && targetId === 'current') {
            this.currentTrackIndex++;
        }

        this.saveToStorage();
        const targetLabel = targetId === 'current' ? 'Queue' : (this.customPlaylists.get(targetId)?.name || 'Playlist');
        this.showNotification(`Moved 1 track to ${targetLabel}`, 'fa-arrow-right');
        // Log move
        this.pushAction('track_move', {
            sourceId,
            targetId,
            sourceLabel: sourceId === 'current' ? 'Queue' : (this.customPlaylists.get(sourceId)?.name || 'Playlist'),
            targetLabel,
            indices: [sourceIndex],
            count: 1,
            tracks: track ? [{ id: track.id, name: track.name }] : []
        }, true);
        // Re-render affected views
        this.renderPlaylistTabs();
        if (this.currentPlaylistId === sourceId || this.currentPlaylistId === targetId) {
            this.renderPlaylist();
        }
    }

    moveMultipleTracksBetweenPlaylists(sourceId, sourceIndices, targetId) {
        const sourceArr = this.getPlaylistArrayById(sourceId);
        const targetArr = this.getPlaylistArrayById(targetId) || (this.customPlaylists.get(targetId)?.tracks);
        if (!sourceArr || !targetArr) return;

        // Sort indices in descending order to avoid index shifting issues
        const sortedIndices = [...sourceIndices].sort((a, b) => b - a);
        const tracksToMove = [];

        // Extract tracks in reverse order
        for (const index of sortedIndices) {
            if (index >= 0 && index < sourceArr.length) {
                const [track] = sourceArr.splice(index, 1);
                if (track) {
                    tracksToMove.unshift(track); // Add to beginning to maintain original order
                }
            }
        }

        if (tracksToMove.length === 0) return;

        // Insert tracks at front when moving into Current Queue, otherwise append
        if (targetId === 'current') {
            targetArr.unshift(...tracksToMove);
        } else {
            targetArr.push(...tracksToMove);
        }

        // Adjust current track index and playback if we moved from the currently viewed playlist
        if (this.currentPlaylistId === sourceId) {
            const movedIndices = new Set(sourceIndices);
            let adjustmentCount = 0;
            
            for (const index of sourceIndices) {
                if (index < this.currentTrackIndex) {
                    adjustmentCount++;
                } else if (index === this.currentTrackIndex) {
                    // Current track was moved
                    const list = this.getCurrentPlaylist();
                    if (list.length === 0) {
                        this.stop();
                    } else {
                        this.currentTrackIndex = Math.min(this.currentTrackIndex, list.length - 1);
                        this.loadTrack(this.currentTrackIndex);
                        if (this.isPlaying) this.play();
                    }
                    break;
                }
            }
            
            this.currentTrackIndex -= adjustmentCount;
        }

        // If we inserted at the front of the currently viewed playlist,
        // shift currentTrackIndex to keep the same song highlighted/playing
        if (this.currentPlaylistId === targetId && targetId === 'current') {
            this.currentTrackIndex += tracksToMove.length;
        }

        this.saveToStorage();
        const count = tracksToMove.length;
        const targetLabel = targetId === 'current' ? 'Queue' : (this.customPlaylists.get(targetId)?.name || 'Playlist');
        this.showNotification(`Moved ${count} track${count>1?'s':''} to ${targetLabel}`, 'fa-layer-group');
        // Log move multiple
        this.pushAction('track_move', {
            sourceId,
            targetId,
            sourceLabel: sourceId === 'current' ? 'Queue' : (this.customPlaylists.get(sourceId)?.name || 'Playlist'),
            targetLabel,
            indices: sourceIndices,
            count,
            tracks: tracksToMove.map(t => ({ id: t.id, name: t.name }))
        }, true);
        // Re-render affected views
        this.renderPlaylistTabs();
        if (this.currentPlaylistId === sourceId || this.currentPlaylistId === targetId) {
            this.renderPlaylist();
        }
    }

    switchPlaylist(playlistId) {
        this.currentPlaylistId = playlistId;
        this.currentTrackIndex = 0;
        this.clearSelection(); // Clear selection when switching playlists
        this.renderPlaylistTabs();
        this.renderPlaylist();
        
        // Load first track if available
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length > 0) {
            this.loadTrack(0);
        } else {
            this.updateTrackInfo('No track selected', 'Upload music to get started');
        }
    }

    getCurrentPlaylist() {
        if (this.currentPlaylistId === 'current') {
            return this.playlist;
        }
        return this.customPlaylists.get(this.currentPlaylistId)?.tracks || [];
    }

    removeTrack(index) {
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist[index]) {
            const removed = currentPlaylist[index];
            // Revoke the object URL to free memory
            URL.revokeObjectURL(currentPlaylist[index].url);
            
            currentPlaylist.splice(index, 1);
            
            // Adjust current track index if necessary
            if (index < this.currentTrackIndex) {
                this.currentTrackIndex--;
            } else if (index === this.currentTrackIndex) {
                if (currentPlaylist.length === 0) {
                    this.stop();
                } else {
                    this.currentTrackIndex = Math.min(this.currentTrackIndex, currentPlaylist.length - 1);
                    this.loadTrack(this.currentTrackIndex);
                }
            }
            
            this.renderPlaylist();
            this.saveToStorage();

            // Log removal with context
            this.pushAction('track_remove', { 
                sourceId: this.currentPlaylistId,
                sourceLabel: this.currentPlaylistId === 'current' ? 'Queue' : (this.customPlaylists.get(this.currentPlaylistId)?.name || 'Playlist'),
                tracks: [{ id: removed.id, name: removed.name, index }],
                count: 1
            }, true);
        }
    }

    clearPlaylist() {
        const currentPlaylist = this.getCurrentPlaylist();
        const playlistName = this.currentPlaylistId === 'current' ? 'Queue' : (this.customPlaylists.get(this.currentPlaylistId)?.name || 'Playlist');
        const trackCount = currentPlaylist.length;
        
        if (trackCount === 0) {
            this.showNotification('Playlist is already empty', 'fa-info-circle');
            return;
        }
        
        const confirmMessage = `Are you sure you want to clear the ${playlistName}?\n\nThis will remove ${trackCount} track${trackCount > 1 ? 's' : ''}. You can undo this action from the action logs.`;
        
        this.showConfirmDialog(confirmMessage, () => {
            // User confirmed - proceed with clearing
            this.hideConfirmDialog();
            this.performClearPlaylist();
        });
    }

    performClearPlaylist() {
        const currentPlaylist = this.getCurrentPlaylist();
        const playlistName = this.currentPlaylistId === 'current' ? 'Queue' : (this.customPlaylists.get(this.currentPlaylistId)?.name || 'Playlist');
        
        // Revoke all object URLs
        currentPlaylist.forEach(track => {
            URL.revokeObjectURL(track.url);
        });
        
        const removedSnapshot = currentPlaylist.map((t, i) => ({ id: t.id, name: t.name, index: i }));
        currentPlaylist.length = 0;
        this.currentTrackIndex = 0;
        this.stop();
        this.renderPlaylist();
        this.updateTrackInfo('No track selected', 'Upload music to get started');
        this.saveToStorage();

        if (removedSnapshot.length) {
            this.pushAction('track_remove', {
                sourceId: this.currentPlaylistId,
                sourceLabel: this.currentPlaylistId === 'current' ? 'Queue' : (this.customPlaylists.get(this.currentPlaylistId)?.name || 'Playlist'),
                tracks: removedSnapshot,
                count: removedSnapshot.length
            }, true);
        }
        
        this.showNotification(`Cleared ${playlistName}`, 'fa-trash');
    }

    async loadTrack(index) {
        console.log('Loading track at index:', index);
        const currentPlaylist = this.getCurrentPlaylist();
        if (index < 0 || index >= currentPlaylist.length) {
            console.log('Invalid track index:', index, 'Playlist length:', currentPlaylist.length);
            return;
        }
        
        this.currentTrackIndex = index;
        const track = currentPlaylist[index];
        console.log('Loading track:', track.name, 'ID:', track.id, 'URL:', track.url);

        if (!track.url && track.id) {
            console.log('Reconstructing URL for track:', track.name);
            // Reconstruct object URL from IndexedDB on demand
            track.url = await this.db.getObjectUrl(track.id);
            console.log('Reconstructed URL:', track.url);
        }

        if (track.url) {
            console.log('Setting audio source to:', track.url);
            this.audio.src = track.url;
        } else {
            console.error('No URL available for track:', track.name);
        }
        this.updateTrackInfo(track.name || 'Unknown Title', track.artist || 'Unknown Artist', track.album_art, track.album_art_mime);
        this.renderPlaylist();
        
        // Load metadata
        this.audio.load();
        console.log('Track loaded successfully');
    }

    togglePlay() {
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length === 0) return;
        
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length === 0) return;
        
        // If no audio source is loaded, load the current track first
        if (!this.audio.src && this.currentTrackIndex >= 0) {
            this.loadTrack(this.currentTrackIndex);
        }
        
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.albumArt.classList.add('loading');
        }).catch(error => {
            console.error('Error playing audio:', error);
        });
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
        this.albumArt.classList.remove('loading');
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.updatePlayButton();
        this.albumArt.classList.remove('loading');
        this.updateProgress();
    }

    previousTrack() {
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length === 0) return;
        
        let newIndex = this.currentTrackIndex - 1;
        if (newIndex < 0) {
            newIndex = currentPlaylist.length - 1;
        }
        
        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.play();
        }
    }

    nextTrack() {
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length === 0) return;
        
        let newIndex = this.currentTrackIndex + 1;
        if (newIndex >= currentPlaylist.length) {
            newIndex = 0;
        }
        
        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.play();
        }
    }

    handleTrackEnd() {
        const currentPlaylist = this.getCurrentPlaylist();
        switch (this.repeatMode) {
            case 'one':
                this.audio.currentTime = 0;
                this.play();
                break;
            case 'all':
                this.nextTrack();
                if (this.isPlaying) {
                    this.play();
                }
                break;
            default:
                if (this.currentTrackIndex < currentPlaylist.length - 1) {
                    this.nextTrack();
                    if (this.isPlaying) {
                        this.play();
                    }
                } else {
                    this.stop();
                }
                break;
        }
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        this.shuffleBtn.classList.toggle('active', this.isShuffled);
    }

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        this.repeatBtn.classList.remove('active');
        if (this.repeatMode !== 'none') {
            this.repeatBtn.classList.add('active');
        }
    }

    seekTo(event) {
        if (this.isDraggingProgress) return;
        
        const currentPlaylist = this.getCurrentPlaylist();
        if (currentPlaylist.length === 0) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const time = percent * this.audio.duration;
        
        this.audio.currentTime = time;
    }

    startProgressDrag(event) {
        this.isDraggingProgress = true;
        event.preventDefault();
    }

    setVolume(event) {
        if (this.isDraggingVolume) return;
        
        const rect = this.volumeBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.volume = Math.max(0, Math.min(1, percent));
        
        this.audio.volume = this.volume;
        this.updateVolumeDisplay();
        
        // Hide mute indicator if volume is set to non-zero
        if (this.volume > 0) {
            this.muteIndicator.style.display = 'none';
        }
    }

    startVolumeDrag(event) {
        this.isDraggingVolume = true;
        event.preventDefault();
    }

    handleMouseMove(event) {
        if (this.isDraggingVolume) {
            const rect = this.volumeBar.getBoundingClientRect();
            const percent = (event.clientX - rect.left) / rect.width;
            this.volume = Math.max(0, Math.min(1, percent));
            
            this.audio.volume = this.volume;
            this.updateVolumeDisplay();
            
            // Hide mute indicator if volume is set to non-zero
            if (this.volume > 0) {
                this.muteIndicator.style.display = 'none';
            }
        } else if (this.isDraggingProgress) {
            const currentPlaylist = this.getCurrentPlaylist();
            if (currentPlaylist.length === 0) return;
            
            const rect = this.progressBar.getBoundingClientRect();
            const percent = (event.clientX - rect.left) / rect.width;
            const time = percent * this.audio.duration;
            
            this.audio.currentTime = time;
        }
    }

    handleMouseUp() {
        this.isDraggingVolume = false;
        this.isDraggingProgress = false;
    }

    toggleMute() {
        if (this.audio.volume > 0) {
            this.audio.volume = 0;
            this.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            this.muteIndicator.style.display = 'flex';
        } else {
            this.audio.volume = this.volume;
            this.updateVolumeButton();
            this.muteIndicator.style.display = 'none';
        }
        this.updateVolumeDisplay();
    }

    updatePlayButton() {
        const icon = this.isPlaying ? 'fa-pause' : 'fa-play';
        this.playBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    }

    updateVolumeButton() {
        const icon = this.volume === 0 ? 'fa-volume-mute' : 
                    this.volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up';
        this.volumeBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    }

    updateVolumeDisplay() {
        this.volumeProgress.style.width = `${this.volume * 100}%`;
        this.volumeHandle.style.left = `${this.volume * 100}%`;
        this.updateVolumeButton();
        
        // Update volume percentage display
        if (this.volumePercentageEl) {
            this.volumePercentageEl.textContent = `${Math.round(this.volume * 100)}%`;
        }
        
        // Hide mute indicator if volume is not 0
        if (this.audio.volume > 0) {
            this.muteIndicator.style.display = 'none';
        }
    }

    adjustVolume(delta) {
        const oldVolume = this.volume;
        this.volume = Math.max(0, Math.min(1, this.volume + delta));
        this.audio.volume = this.volume;
        this.updateVolumeDisplay();
        
        // Show visual feedback for volume change
        this.showVolumeChangeFeedback(oldVolume, this.volume);
        
        // Hide mute indicator if volume is set to non-zero
        if (this.volume > 0) {
            this.muteIndicator.style.display = 'none';
        }
    }

    showVolumeChangeFeedback(oldVolume, newVolume) {
        const change = newVolume - oldVolume;
        const currentVolume = Math.round(newVolume * 100);
        
        let message, icon;
        if (change > 0) {
            message = `Volume increased to ${currentVolume}%`;
            icon = 'fa-volume-up';
        } else if (change < 0) {
            message = `Volume decreased to ${currentVolume}%`;
            icon = 'fa-volume-down';
        } else {
            return; // No change, don't show notification
        }
        
        // Show notification in bottom left
        this.showNotification(message, icon);
    }


    updateProgress() {
        if (this.audio.duration && !this.isDraggingProgress) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progress.style.width = `${percent}%`;
            this.progressHandle.style.left = `${percent}%`;
            this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateDuration() {
        const currentPlaylist = this.getCurrentPlaylist();
        const track = currentPlaylist[this.currentTrackIndex];
        if (track) {
            track.duration = this.audio.duration;
            this.durationEl.textContent = this.formatTime(this.audio.duration);
            this.renderPlaylist(); // Update duration in playlist
            this.saveToStorage();
        }
    }

    updateTrackInfo(title, artist, albumArt = null, albumArtMime = null) {
        this.trackTitle.textContent = title;
        this.trackArtist.textContent = artist;
        
        // Update album art
        const albumArtElement = document.querySelector('.album-art');
        
        if (albumArtElement) {
            if (albumArt && albumArtMime) {
                // Show album art
                albumArtElement.style.backgroundImage = `url(data:${albumArtMime};base64,${albumArt})`;
                albumArtElement.style.display = 'block';
                albumArtElement.classList.add('has-art');
                
                // Hide the music icon when showing album art
                const musicIcon = albumArtElement.querySelector('i.fa-music');
                if (musicIcon) {
                    musicIcon.style.display = 'none';
                }
            } else {
                // Show spinning CD
                albumArtElement.style.backgroundImage = '';
                albumArtElement.style.display = 'block';
                albumArtElement.classList.remove('has-art');
                
                // Show the music icon when no album art
                const musicIcon = albumArtElement.querySelector('i.fa-music');
                if (musicIcon) {
                    musicIcon.style.display = 'block';
                }
            }
        }
    }

    // Toast notifications
    showNotification(message, icon = 'fa-check-circle') {
        try {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = 'toast glass-card';
            toast.innerHTML = `
                <span class="icon"><i class="fas ${icon}"></i></span>
                <span class="message">${message}</span>
                <button class="close" title="Dismiss">×</button>
            `;
            container.appendChild(toast);
            const remove = () => {
                toast.style.animation = 'toast-out 180ms ease forwards';
                setTimeout(() => toast.remove(), 200);
            };
            toast.querySelector('.close').addEventListener('click', remove);
            setTimeout(remove, 2800);
        } catch (_) {}
    }

    // Persistent top-right banner (same toast style, manual close only)
    showVersionBanner(message, icon = 'fa-info-circle', isWarning = false) {
        try {
            const container = document.getElementById('toastTopRight');
            if (!container) return;

            // Clear previous version banners (keep other toasts if any)
            Array.from(container.querySelectorAll('.toast')).forEach(el => el.remove());

            const toast = document.createElement('div');
            toast.className = 'toast glass-card';
            toast.style.pointerEvents = 'auto';
            toast.innerHTML = `
                <span class="icon"><i class="fas ${icon}"></i></span>
                <span class="message">${message}</span>
                <button class="close" title="Dismiss">×</button>
            `;
            if (isWarning) {
                // subtle emphasis for updates
                toast.style.borderColor = 'rgba(255, 193, 7, 0.45)';
            }
            container.appendChild(toast);
            const remove = () => {
                toast.style.animation = 'toast-out 180ms ease forwards';
                setTimeout(() => toast.remove(), 200);
            };
            toast.querySelector('.close').addEventListener('click', remove);
            // No auto-timeout; stays until closed
        } catch (_) {}
    }

    // Action Log: UI
    showLogs() {
        this.renderLogs();
        this.logsModal.classList.add('active');
    }

    hideLogs() {
        this.logsModal.classList.remove('active');
    }

    showArtists() {
        this.artistsModal.classList.add('active');
        document.body.classList.add('modal-open');
        this.updateArtistsList();
    }

    hideArtists() {
        this.artistsModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    toggleBottomPanels() {
        const isCollapsed = document.body.classList.contains('panels-collapsed');
        
        if (isCollapsed) {
            // Expand panels
            document.body.classList.remove('panels-collapsed');
            this.collapseToggle.classList.remove('expanded');
            this.collapseToggle.setAttribute('data-tooltip', 'Collapse bottom panel');
        } else {
            // Collapse panels
            document.body.classList.add('panels-collapsed');
            this.collapseToggle.classList.add('expanded');
            this.collapseToggle.setAttribute('data-tooltip', 'Expand bottom panel');
        }
    }

    initCustomTooltips() {
        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        document.body.appendChild(this.tooltip);

        // Tooltip delay timer and position tracking
        this.tooltipTimer = null;
        this.tooltipPosition = null;

        // Find all elements with data-tooltip
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => this.startTooltipTimer(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
        });
    }

    startTooltipTimer(event) {
        // Clear any existing timer
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
        }

        // Start new timer for 1 second
        this.tooltipTimer = setTimeout(() => {
            this.showTooltip(event);
        }, 1000);
    }

    showTooltip(event) {
        const element = event.target.closest('[data-tooltip]');
        if (!element) return;

        const text = element.getAttribute('data-tooltip');
        this.tooltip.textContent = text;
        this.tooltip.classList.add('show');
        
        // Calculate and store position once
        this.calculateTooltipPosition(element);
    }

    hideTooltip() {
        // Clear timer if tooltip hasn't shown yet
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        
        this.tooltip.classList.remove('show');
        this.tooltipPosition = null;
    }

    calculateTooltipPosition(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        // Position tooltip above the element
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;

        // Keep tooltip within viewport
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (top < 8) {
            // Position below if not enough space above
            top = rect.bottom + 8;
            this.tooltip.style.transform = 'translateY(0)';
        } else {
            this.tooltip.style.transform = 'translateY(0)';
        }

        // Store the position
        this.tooltipPosition = { left, top };
        
        // Apply the position
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
    }

    updateArtistsList() {
        const artists = this.getArtistsFromPlaylists();
        this.renderArtistsList(artists);
    }

    getArtistsFromPlaylists() {
        const artistMap = new Map();
        
        // Get artists from current playlist (queue)
        this.playlist.forEach(track => {
            if (track.artist && track.artist.trim()) {
                const artist = track.artist.trim();
                if (artistMap.has(artist)) {
                    const artistData = artistMap.get(artist);
                    artistData.count++;
                    artistData.albums.add(track.album || 'Unknown Album');
                    artistData.songs.push(track);
                } else {
                    artistMap.set(artist, { 
                        name: artist, 
                        count: 1,
                        albums: new Set([track.album || 'Unknown Album']),
                        songs: [track],
                        firstLetter: artist.charAt(0).toUpperCase()
                    });
                }
            }
        });
        
        // Get artists from custom playlists
        this.customPlaylists.forEach(playlist => {
            playlist.tracks.forEach(track => {
                if (track.artist && track.artist.trim()) {
                    const artist = track.artist.trim();
                    if (artistMap.has(artist)) {
                        const artistData = artistMap.get(artist);
                        artistData.count++;
                        artistData.albums.add(track.album || 'Unknown Album');
                        artistData.songs.push(track);
                    } else {
                        artistMap.set(artist, { 
                            name: artist, 
                            count: 1,
                            albums: new Set([track.album || 'Unknown Album']),
                            songs: [track],
                            firstLetter: artist.charAt(0).toUpperCase()
                        });
                    }
                }
            });
        });

        // Convert to array and sort by name
        return Array.from(artistMap.values()).map(artist => ({
            ...artist,
            albums: Array.from(artist.albums),
            albumCount: artist.albums.size
        })).sort((a, b) => a.name.localeCompare(b.name));
    }

    renderArtistsList(artists) {
        this.artistsList.innerHTML = '';
        
        if (artists.length === 0) {
            this.artistsList.innerHTML = `
                <div class="artist-item" style="justify-content: center; cursor: default;">
                    <div class="artist-info">
                        <div class="artist-name">No artists found</div>
                        <div class="artist-count">Upload some music to see artists</div>
                    </div>
                </div>
            `;
            return;
        }

        artists.forEach(artist => {
            const artistItem = document.createElement('div');
            artistItem.className = 'artist-item';
            artistItem.innerHTML = `
                <div class="artist-avatar">
                    <span class="artist-initial">${artist.firstLetter}</span>
                </div>
                <div class="artist-info">
                    <div class="artist-name">${artist.name}</div>
                    <div class="artist-details">
                        <span class="artist-count">${artist.count} song${artist.count !== 1 ? 's' : ''}</span>
                        <span class="artist-separator">•</span>
                        <span class="artist-albums">${artist.albumCount} album${artist.albumCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="artist-album-list">${artist.albums.slice(0, 2).join(', ')}${artist.albums.length > 2 ? '...' : ''}</div>
                </div>
                <div class="artist-action">
                    <i class="fas fa-plus-circle"></i>
                </div>
            `;
            
            artistItem.addEventListener('click', () => this.createArtistPlaylist(artist.name));
            this.artistsList.appendChild(artistItem);
        });
    }

    createArtistPlaylist(artistName) {
        // Get all songs by this artist
        const artistSongs = [];
        
        // Check current playlist (queue)
        this.playlist.forEach(track => {
            if (track.artist && track.artist.trim() === artistName) {
                artistSongs.push(track);
            }
        });
        
        // Check custom playlists
        this.customPlaylists.forEach(playlist => {
            playlist.tracks.forEach(track => {
                if (track.artist && track.artist.trim() === artistName) {
                    artistSongs.push(track);
                }
            });
        });

        if (artistSongs.length === 0) {
            this.showNotification(`No songs found for ${artistName}`, 'fa-exclamation-triangle');
            return;
        }

        // Create playlist with artist name
        const playlistId = `artist_${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const playlist = {
            name: artistName,
            tracks: artistSongs,
            cover: null
        };

        this.customPlaylists.set(playlistId, playlist);
        this.saveToStorage();
        this.renderPlaylistTabs();
        this.showNotification(`Created playlist "${artistName}" with ${artistSongs.length} songs`, 'fa-music');
        this.hideArtists();
    }


    showClearLogsConfirm() {
        this.confirmMessage.textContent = 'Are you sure you want to clear all action logs? This cannot be undone.';
        this.confirmModal.classList.add('active');
        this.pendingAction = 'clearLogs';
    }

    clearLogs() {
        this.actionLog = [];
        this.saveActionLog();
        this.renderLogs();
        this.showNotification('Action logs cleared', 'fa-trash');
    }

    showConfirmModal(message, action) {
        this.confirmMessage.textContent = message;
        this.confirmModal.classList.add('active');
        this.pendingAction = action;
    }

    hideConfirmModal() {
        this.confirmModal.classList.remove('active');
        this.pendingAction = null;
    }

    handleConfirmOk() {
        if (this.pendingAction === 'clearLogs') {
            this.clearLogs();
        } else if (this.pendingAction === 'joinDiscord') {
            const url = this.pendingDiscordUrl || 'https://discord.gg/SbQuPNJHnP';
            try {
                window.open(url, '_blank', 'noopener');
                this.showNotification('Opening Discord…', 'fa-up-right-from-square');
            } catch (_) {}
            this.pendingDiscordUrl = null;
        }
        this.hideConfirmModal();
    }

    // Player maximize/minimize
    togglePlayerMaximize() {
        if (!this.playerCard) return;
        const isMax = this.playerCard.classList.toggle('maximized');
        const existingOverlay = document.querySelector('.player-overlay');
        if (isMax) {
            if (!existingOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'player-overlay';
                overlay.addEventListener('click', () => this.togglePlayerMaximize());
                document.body.appendChild(overlay);
            }
            document.body.classList.add('modal-open');
        } else {
            if (existingOverlay) existingOverlay.remove();
            document.body.classList.remove('modal-open');
        }
    }

    // Drag & Drop: bind global handlers
    bindDragAndDrop() {
        let dragCounter = 0;
        
        const showOverlay = () => {
            if (this.dropOverlay) this.dropOverlay.classList.add('active');
        };
        const hideOverlay = () => {
            if (this.dropOverlay) this.dropOverlay.classList.remove('active');
        };

        // Prevent default to allow drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            document.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('dragenter', (e) => {
            // Only show overlay for external file drops, not internal drag operations
            const hasFiles = e.dataTransfer.types.includes('Files') || 
                           e.dataTransfer.types.includes('application/x-moz-file');
            const isInternalDrag = e.dataTransfer.getData('text/plain');
            
            if (hasFiles && !isInternalDrag) {
                dragCounter++;
                if (dragCounter === 1) {
                    showOverlay();
                }
            }
        });
        
        document.addEventListener('dragover', (e) => {
            // Only set copy effect for external files
            const hasFiles = e.dataTransfer.types.includes('Files') || 
                           e.dataTransfer.types.includes('application/x-moz-file');
            const isInternalDrag = e.dataTransfer.getData('text/plain');
            
            if (hasFiles && !isInternalDrag) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            // Only hide overlay if we're leaving the document entirely
            if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
                dragCounter = 0;
                hideOverlay();
            }
        });
        
        document.addEventListener('drop', async (e) => {
            dragCounter = 0;
            hideOverlay();
            const dt = e.dataTransfer;
            if (!dt) return;
            
            // Check if this is an internal drag operation
            const isInternalDrag = dt.getData('text/plain');
            if (isInternalDrag) {
                // This is handled by the playlist item drop handlers
                return;
            }
            
            const items = dt.items && dt.items.length ? Array.from(dt.items) : [];
            const files = dt.files && dt.files.length ? Array.from(dt.files) : [];

            if (items.length) {
                await this.handleDroppedItems(items);
            } else if (files.length) {
                await this.handleDroppedFiles(files);
            }
        });
    }

    async handleDroppedItems(items) {
        // Prefer DataTransferItem (can be directories via webkitGetAsEntry)
        const audioFiles = [];
        const traverseEntry = async (entry) => {
            return new Promise((resolve) => {
                try {
                    if (entry.isFile) {
                        entry.file((file) => {
                            if (file && file.type && file.type.startsWith('audio/')) {
                                audioFiles.push(file);
                            }
                            resolve();
                        }, () => resolve());
                    } else if (entry.isDirectory) {
                        const reader = entry.createReader();
                        reader.readEntries(async (entries) => {
                            for (const ent of entries) {
                                await traverseEntry(ent);
                            }
                            resolve();
                        }, () => resolve());
                    } else {
                        resolve();
                    }
                } catch (_) { resolve(); }
            });
        };

        const entries = [];
        for (const item of items) {
            try {
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry) entries.push(entry);
                }
            } catch (_) {}
        }

        if (entries.length) {
            for (const entry of entries) {
                await traverseEntry(entry);
            }
        } else {
            // Fallback: treat as files
            const files = [];
            for (const item of items) {
                try {
                    const file = item.getAsFile && item.getAsFile();
                    if (file && file.type && file.type.startsWith('audio/')) files.push(file);
                } catch (_) {}
            }
            await this.handleDroppedFiles(files);
            return;
        }

        if (audioFiles.length) {
            this.showNotification(`Processing ${audioFiles.length} file${audioFiles.length>1?'s':''}...`, 'fa-spinner fa-spin');
            // Insert at top while preserving source order
            for (let i = audioFiles.length - 1; i >= 0; i--) {
                await this.addTrackToPlaylist(audioFiles[i], true);
            }
            this.showNotification(`Added ${audioFiles.length} file${audioFiles.length>1?'s':''} to top of queue`, 'fa-cloud-upload-alt');
        }
    }

    async handleDroppedFiles(files) {
        if (!files || !files.length) return;
        const audioFiles = files.filter(f => f.type && f.type.startsWith('audio/'));
        if (audioFiles.length) {
            this.showNotification(`Processing ${audioFiles.length} file${audioFiles.length>1?'s':''}...`, 'fa-spinner fa-spin');
            // Insert at top while preserving source order
            for (let i = audioFiles.length - 1; i >= 0; i--) {
                await this.addTrackToPlaylist(audioFiles[i], true);
            }
            this.showNotification(`Added ${audioFiles.length} file${audioFiles.length>1?'s':''} to top of queue`, 'fa-cloud-upload-alt');
        }
    }

    renderLogs() {
        if (!this.logsList) return;
        if (!this.actionLog || this.actionLog.length === 0) {
            this.logsList.innerHTML = `
                <div class="playlist-empty">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No actions yet</p>
                    <p>Actions like create, delete, and move will appear here</p>
                </div>
            `;
            return;
        }

        this.logsList.innerHTML = this.actionLog
            .slice()
            .reverse()
            .map(action => {
                const ts = new Date(action.timestamp).toLocaleString();
                const title = this.describeActionTitle(action);
                const meta = this.describeActionMeta(action);
                return `
                    <div class="log-item">
                        <div class="log-main">
                            <div class="log-title">${title}</div>
                            <div class="log-meta">${meta} • ${ts}</div>
                        </div>
                        <div class="log-actions">
                            ${action.canUndo ? `<button class="undo-btn" data-id="${action.id}"><i class=\"fas fa-undo\"></i> Undo</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

        // Bind undo buttons
        this.logsList.querySelectorAll('.undo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                this.undoAction(id);
            });
        });
    }

    describeActionTitle(action) {
        switch (action.type) {
            case 'playlist_create': return `Created playlist "${action.data.name}"`;
            case 'playlist_delete': return `Deleted playlist "${action.data.name}"`;
            case 'track_add': return `Added ${action.data.count === 1 ? 'track' : action.data.count + ' tracks'} to ${action.data.targetLabel}`;
            case 'track_remove': return `Removed ${action.data.count === 1 ? 'track' : action.data.count + ' tracks'}`;
            case 'track_move': return `Moved ${action.data.count === 1 ? 'track' : action.data.count + ' tracks'} to ${action.data.targetLabel}`;
            default: return action.type;
        }
    }

    describeActionMeta(action) {
        switch (action.type) {
            case 'playlist_create':
                return `Playlist ID: ${action.data.id}`;
            case 'playlist_delete':
                return `Playlist ID: ${action.data.id}`;
            case 'track_add':
                return `Into: ${action.data.targetId}`;
            case 'track_remove':
                return `From: ${action.data.sourceId}`;
            case 'track_move':
                return `From ${action.data.sourceId} → ${action.data.targetId}`;
            default:
                return '';
        }
    }

    // Action Log: helpers
    pushAction(type, data, canUndo = true) {
        const entry = {
            id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            type,
            data,
            timestamp: Date.now(),
            canUndo
        };
        this.actionLog.push(entry);
        this.saveActionLog();
        this.renderLogs();
        return entry.id;
    }

    undoAction(actionId) {
        const idx = this.actionLog.findIndex(a => a.id === actionId);
        if (idx < 0) return;
        const action = this.actionLog[idx];
        switch (action.type) {
            case 'playlist_create':
                this.undoCreatePlaylist(action);
                break;
            case 'playlist_delete':
                this.undoDeletePlaylist(action);
                break;
            case 'track_add':
                this.undoTrackAdd(action);
                break;
            case 'track_remove':
                this.undoTrackRemove(action);
                break;
            case 'track_move':
                this.undoTrackMove(action);
                break;
            default:
                return;
        }
        // Mark as not undoable after success
        this.actionLog[idx].canUndo = false;
        this.saveActionLog();
        this.renderLogs();
    }

    undoCreatePlaylist(action) {
        const id = action.data.id;
        if (!this.customPlaylists.has(id)) return;
        this.customPlaylists.delete(id);
        if (this.currentPlaylistId === id) this.switchPlaylist('current');
        this.renderPlaylistTabs();
        this.saveToStorage();
        this.showNotification(`Undid: created playlist "${action.data.name}"`, 'fa-undo');
    }

    undoDeletePlaylist(action) {
        const { id, name, cover, tracks } = action.data;
        if (this.customPlaylists.has(id)) return;
        this.customPlaylists.set(id, { name, cover, tracks });
        this.renderPlaylistTabs();
        this.saveToStorage();
        this.showNotification(`Undid: deleted playlist "${name}"`, 'fa-undo');
    }

    undoTrackAdd(action) {
        const { targetId, tracks } = action.data;
        const arr = this.getPlaylistArrayById(targetId);
        if (!arr) return;
        const ids = new Set(tracks.map(t => t.id));
        for (let i = arr.length - 1; i >= 0; i--) {
            if (ids.has(arr[i].id)) {
                URL.revokeObjectURL(arr[i].url);
                arr.splice(i, 1);
            }
        }
        this.renderPlaylist();
        this.saveToStorage();
        this.showNotification(`Undid: add ${tracks.length > 1 ? tracks.length + ' tracks' : 'track'}`, 'fa-undo');
    }

    undoTrackRemove(action) {
        const { sourceId, tracks } = action.data;
        const arr = this.getPlaylistArrayById(sourceId);
        if (!arr) return;
        const sorted = [...tracks].sort((a,b) => a.index - b.index);
        sorted.forEach(t => {
            arr.splice(Math.min(t.index, arr.length), 0, { 
                id: t.id, 
                name: t.name, 
                artist: t.artist,
                album: t.album,
                year: t.year,
                genre: t.genre,
                url: null, 
                duration: 0,
                album_art: t.album_art,
                album_art_mime: t.album_art_mime
            });
        });
        this.renderPlaylist();
        this.saveToStorage();
        this.showNotification(`Undid: remove ${tracks.length > 1 ? tracks.length + ' tracks' : 'track'}`, 'fa-undo');
    }

    undoTrackMove(action) {
        const { sourceId, targetId } = action.data;
        const sourceArr = this.getPlaylistArrayById(sourceId);
        const targetArr = this.getPlaylistArrayById(targetId);
        if (!sourceArr || !targetArr) return;
        const ids = new Set((action.data.tracks || []).map(t => t.id));
        if (ids.size === 0) return;
        for (let i = targetArr.length - 1; i >= 0; i--) {
            const tr = targetArr[i];
            if (ids.has(tr.id)) {
                const [track] = targetArr.splice(i, 1);
                sourceArr.unshift(track);
            }
        }
        this.renderPlaylistTabs();
        this.renderPlaylist();
        this.saveToStorage();
        this.showNotification(`Undid: move tracks`, 'fa-undo');
    }

    handleAudioError(error) {
        console.error('Audio error:', error);
    }

    handleKeyboard(event) {
        // Handle confirmation dialog keyboard shortcuts first
        if (this.confirmDialogOverlay.classList.contains('show')) {
            if (event.code === 'Escape') {
                event.preventDefault();
                this.hideConfirmDialog();
                return;
            } else if (event.code === 'Enter') {
                event.preventDefault();
                this.executeConfirmDialogCallback();
                return;
            }
        }
        
        // Prevent default behavior for space bar
        if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            this.togglePlay();
        } else if (event.code === 'ArrowLeft') {
            event.preventDefault();
            this.previousTrack();
        } else if (event.code === 'ArrowRight') {
            event.preventDefault();
            this.nextTrack();
        } else if (event.code === 'ArrowUp') {
            event.preventDefault();
            this.adjustVolume(0.05); // +5%
        } else if (event.code === 'ArrowDown') {
            event.preventDefault();
            this.adjustVolume(-0.05); // -5%
        } else if (event.code === 'KeyM') {
            event.preventDefault();
            this.toggleMute();
        } else if (event.code === 'KeyS') {
            event.preventDefault();
            this.toggleShuffle();
        } else if (event.code === 'KeyR') {
            // Only prevent default if CTRL is not pressed (to allow CTRL+R for refresh)
            if (!event.ctrlKey) {
                event.preventDefault();
                this.toggleRepeat();
            }
        } else if (event.code === 'Escape') {
            // Clear selection on Escape
            this.clearSelection();
            this.renderPlaylist();
        }
    }

    // Playlist Management
    showPlaylistModal() {
        this.playlistModal.classList.add('active');
        this.playlistName.value = '';
        this.coverUpload.style.display = 'flex';
        this.coverPreview.style.display = 'none';
        this.coverImage.src = '';
    }

    hidePlaylistModal() {
        this.playlistModal.classList.remove('active');
    }

    handleCoverUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.coverImage.src = e.target.result;
                this.coverUpload.style.display = 'none';
                this.coverPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    removeCoverImage() {
        this.coverUpload.style.display = 'flex';
        this.coverPreview.style.display = 'none';
        this.coverImage.src = '';
        this.playlistCover.value = '';
    }

    createNewPlaylist() {
        const name = this.playlistName.value.trim();
        if (!name) {
            alert('Please enter a playlist name.');
            return;
        }

        const playlistId = 'playlist_' + Date.now();
        const cover = this.coverImage.src || null;
        
        this.customPlaylists.set(playlistId, {
            name: name,
            cover: cover,
            tracks: []
        });

        this.renderPlaylistTabs();
        this.hidePlaylistModal();
        this.saveToStorage();

        this.pushAction('playlist_create', { id: playlistId, name, cover }, true);
    }

    deletePlaylist(playlistId) {
        const playlist = this.customPlaylists.get(playlistId);
        const playlistName = playlist ? playlist.name : 'Playlist';
        const trackCount = playlist ? playlist.tracks.length : 0;
        
        const confirmMessage = `Are you sure you want to delete "${playlistName}"?\n\nThis will remove the playlist and ${trackCount} track${trackCount > 1 ? 's' : ''}. You can undo this action from the action logs.`;
        
        this.showConfirmDialog(confirmMessage, () => {
            // User confirmed - proceed with deletion
            this.hideConfirmDialog();
            this.performDeletePlaylist(playlistId);
        });
    }

    performDeletePlaylist(playlistId) {
        const playlist = this.customPlaylists.get(playlistId);
        if (playlist) {
            // Revoke all object URLs
            playlist.tracks.forEach(track => {
                URL.revokeObjectURL(track.url);
            });
        }
        
        // Capture for undo
        const snapshot = playlist ? { id: playlistId, name: playlist.name, cover: playlist.cover, tracks: [...playlist.tracks] } : null;
        this.customPlaylists.delete(playlistId);
        
        // Switch to current queue if we were viewing the deleted playlist
        if (this.currentPlaylistId === playlistId) {
            this.switchPlaylist('current');
        }
        
        this.renderPlaylistTabs();
        this.saveToStorage();

        if (snapshot) this.pushAction('playlist_delete', snapshot, true);
        
        this.showNotification(`Deleted "${playlist.name}"`, 'fa-trash');
    }

    // Settings Management
    toggleSettings() {
        this.settingsContent.classList.toggle('active');
        if (this.settingsContent.classList.contains('active')) {
            this.runVersionCheck(false);
        }
    }

    hideSettings() {
        this.settingsContent.classList.remove('active');
    }

    async runVersionCheck(force) {
        try {
            const current = 'v5.2.0'; // Current version from HTML comment
            let latest = null;
            let update = false;

            // Try to fetch latest version from GitHub
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                
                // Try local server first (for development)
                let res;
                try {
                    res = await fetch('/version', { signal: controller.signal, cache: 'no-store' });
                } catch (localError) {
                    // If local server fails, try GitHub directly
                    res = await fetch('https://raw.githubusercontent.com/Jahbas/Liquid-Music/main/README.md', { 
                        signal: controller.signal, 
                        cache: 'no-store',
                        headers: { 'User-Agent': 'Liquid-Music-Updater' }
                    });
                }
                
                clearTimeout(timeout);
                
                if (res.ok) {
                    if (res.url.includes('github.com')) {
                        // Parse GitHub README for version
                        const text = await res.text();
                        console.log('GitHub README content preview:', text.substring(0, 500));
                        
                        const patterns = [
                            /Version:\s*v(\d+\.\d+\.\d+(?:\.\d+)?)/i,  // Version: v5.2.0
                            /Version-(\d+\.\d+\.\d+(?:\.\d+)?)/i,      // Version-5.2.0 (badge)
                            /Version[\s:-]*v(\d+\.\d+\.\d+(?:\.\d+)?)/i, // General pattern
                            /badge\/Version-(\d+\.\d+\.\d+(?:\.\d+)?)/i, // Badge format
                            /\*\*Version:\s*v(\d+\.\d+\.\d+(?:\.\d+)?)\*\*/i // Markdown bold
                        ];
                        
                        for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match) {
                                latest = `v${match[1]}`;
                                console.log('Found version with pattern:', pattern, '->', latest);
                                break;
                            }
                        }
                        
                        if (!latest) {
                            console.log('No version found in README, trying fallback patterns');
                            // Fallback: look for any version-like pattern
                            const fallbackPatterns = [
                                /v(\d+\.\d+\.\d+(?:\.\d+)?)/i,
                                /(\d+\.\d+\.\d+(?:\.\d+)?)/
                            ];
                            
                            for (const pattern of fallbackPatterns) {
                                const match = text.match(pattern);
                                if (match) {
                                    latest = match[0].startsWith('v') ? match[0] : `v${match[0]}`;
                                    console.log('Found version with fallback pattern:', pattern, '->', latest);
                                    break;
                                }
                            }
                        }
                    } else {
                        // Local server response
                        const data = await res.json();
                        latest = data.latest;
                        update = !!data.update_available;
                    }
                }
            } catch (fetchError) {
                console.warn('Version fetch failed:', fetchError);
            }

            // Compare versions if we got latest
            if (latest && latest !== current) {
                update = true;
            }

            if (update) {
                this.showVersionBanner(`Update available: ${latest} (current ${current})`, 'fa-bell', true);
            } else {
                this.showVersionBanner(`Version ${current}`, 'fa-check', false);
            }

            if (force) {
                if (update) this.showNotification(`Update available: ${latest}`, 'fa-bell');
                else this.showNotification('You are up to date', 'fa-check');
            }
        } catch (error) {
            console.warn('Version check failed:', error);
            this.showVersionBanner('Version check failed', 'fa-exclamation-triangle', true);
            if (force) this.showNotification('Version check failed', 'fa-exclamation-triangle');
        }
    }
    
    async updateStorageStatus() {
        if (!this.storageInfo) return;
        
        const persistentCount = this.db.getPersistentCount();
        const temporaryCount = this.db.getTemporaryCount();
        const totalStored = persistentCount + temporaryCount;
        
        // Get storage quota info
        let quotaText = '';
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const quotaMB = Math.round(estimate.quota / 1024 / 1024);
                const usedMB = Math.round(estimate.usage / 1024 / 1024);
                quotaText = `<br><small>Storage: ${usedMB}MB / ${quotaMB}MB available</small>`;
            }
        } catch (e) {
            console.log('Could not get storage estimate:', e);
        }
        
        if (totalStored === 0) {
            this.storageInfo.textContent = 'No files stored';
        } else if (temporaryCount === 0) {
            // All files are persistent
            this.storageInfo.innerHTML = `
                <span style="color: #4CAF50;">${persistentCount} files stored persistently</span>
                <br><small>All files will persist on refresh</small>
                ${quotaText}
            `;
        } else if (persistentCount === 0) {
            // All files are temporary
            this.storageInfo.innerHTML = `
                <span style="color: #FF9800;">${temporaryCount} files in temporary storage</span>
                <br><small>Files will be lost on refresh (IndexedDB not working)</small>
                ${quotaText}
            `;
        } else {
            // Mixed storage
            this.storageInfo.innerHTML = `
                <span style="color: #4CAF50;">${persistentCount} persistent</span> + 
                <span style="color: #FF9800;">${temporaryCount} temporary</span>
                <br><small>${persistentCount} files will persist on refresh</small>
                ${quotaText}
            `;
        }
    }

    async clearOldStorage() {
        try {
            // Clear old IndexedDB entries
            await this.db.clearOldIndexedDBEntries();
            
            // Clear old localStorage entries
            this.db.clearOldLocalStorageEntries();
            
            // Update storage status
            this.updateStorageStatus();
            
            // Show success notification
            this.showNotification('Old files cleared to make space for new ones', 'fa-broom');
            
        } catch (error) {
            console.error('Error clearing old storage:', error);
            this.showNotification('Error clearing old files', 'fa-exclamation-triangle');
        }
    }

    openMusicFolder() {
        // Create a music folder in the same directory as the app
        const musicFolderPath = './music';
        
        // Show instructions to the user
        this.showNotification('Music folder: ./music - Add your music files there!', 'fa-folder-open');
        
        // Try to open the folder (this will work if the server is running)
        try {
            // Create a link to open the folder
            const link = document.createElement('a');
            link.href = musicFolderPath;
            link.target = '_blank';
            link.click();
        } catch (error) {
            console.log('Could not open folder directly:', error);
        }
        
        // Show detailed instructions
        setTimeout(() => {
            this.showNotification('1. Create a "music" folder in the app directory 2. Add your MP3 files 3. Click "Scan Music Folder"', 'fa-info-circle');
        }, 2000);
    }

    async scanMusicFolder() {
        try {
            // Show loading notification
            this.showNotification('Scanning music folder...', 'fa-sync');
            
            // Try to fetch the music folder contents from the server
            const response = await fetch('/api/music-folder');
            
            if (response.ok) {
                const files = await response.json();
                
                if (files.length === 0) {
                    this.showNotification('No music files found in the music folder', 'fa-exclamation-triangle');
                    return;
                }
                
                // Add files to playlist with metadata extraction
                let addedCount = 0;
                const totalFiles = files.length;
                
                // Show progress notification
                this.showNotification(`Extracting metadata for ${totalFiles} files...`, 'fa-music');
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        // Update progress
                        if (i % 10 === 0 || i === files.length - 1) {
                            this.showNotification(`Processing ${i + 1}/${totalFiles} files...`, 'fa-music');
                        }
                        
                        // Fetch metadata for the file
                        const metadataResponse = await fetch(`/api/music-metadata/${encodeURIComponent(file.path)}`);
                        let metadata = {};
                        
                        if (metadataResponse.ok) {
                            metadata = await metadataResponse.json();
                        }
                        
                        // Create a track object with extracted metadata
                        const track = {
                            id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                            name: metadata.title || file.name.replace(/\.[^/.]+$/, ""), // Use extracted title or filename
                            artist: metadata.artist || "Unknown Artist",
                            album: metadata.album || "Local Music",
                            year: metadata.year || "",
                            genre: metadata.genre || "",
                            duration: metadata.duration || 0,
                            album_art: metadata.album_art || null,
                            album_art_mime: metadata.album_art_mime || null,
                            url: `/api/music-file/${encodeURIComponent(file.path)}`,
                            isLocalFile: true
                        };
                        
                        // Add to playlist directly
                        this.playlist.push(track);
                        addedCount++;
                        
                    } catch (error) {
                        console.error('Error adding file:', file.name, error);
                    }
                }
                
                // Update the UI after adding all files
                if (addedCount > 0) {
                    this.renderPlaylist();
                    this.saveToStorage();
                }
                
                this.showNotification(`Added ${addedCount} files from music folder`, 'fa-music');
                
            } else {
                this.showNotification('Music folder not found. Create a "music" folder in the app directory.', 'fa-exclamation-triangle');
            }
            
        } catch (error) {
            console.error('Error scanning music folder:', error);
            this.showNotification('Error scanning music folder. Make sure the server is running.', 'fa-exclamation-triangle');
        }
    }

    // Theme section removed

    // changeTheme removed; always dark

    togglePerformanceMode() {
        if (this.performanceMode.checked) {
            document.body.classList.add('performance-mode');
        } else {
            document.body.classList.remove('performance-mode');
        }
        this.saveSettings();
    }

    toggleGlassEffects() {
        if (this.glassEffects.checked) {
            document.body.classList.remove('no-glass');
        } else {
            document.body.classList.add('no-glass');
        }
        this.saveSettings();
    }

    toggleThickSongs() {
        if (this.thickSongs.checked) {
            document.body.classList.add('thick-songs');
        } else {
            document.body.classList.remove('thick-songs');
        }
        this.saveSettings();
    }

    toggleAnimatedBackground() {
        if (this.animatedBg.checked) {
            document.body.classList.remove('no-bg');
        } else {
            document.body.classList.add('no-bg');
        }
        this.saveSettings();
    }

    applyHoverEffectsSetting() {
        const isDisabled = !!(this.disableHover && this.disableHover.checked);
        document.body.classList.toggle('no-hover', isDisabled);
        try {
            const raw = localStorage.getItem('musicPlayerSettings');
            const parsed = raw ? JSON.parse(raw) : {};
            parsed.noHover = isDisabled;
            localStorage.setItem('musicPlayerSettings', JSON.stringify(parsed));
        } catch (_) { /* ignore */ }
    }

    changeTheme(theme) {
        // Remove current theme class
        document.body.classList.remove(`theme-${this.currentTheme}`);
        document.body.removeAttribute('data-theme');
        
        // Set new theme
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        // Update active button
        this.themeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });
        
        this.saveSettings();
        const themeNames = {
            'glass': 'Glass',
            'dark': 'Dark', 
            'light': 'Midnight',
            'purple': 'Purple'
        };
        const themeName = themeNames[theme] || theme;
        this.showNotification(`Switched to ${themeName} theme`, 'fa-palette');
    }

    updateDefaultVolumeFromSlider() {
        const volume = parseInt(this.defaultVolumeSlider.value) / 100;
        this.defaultVolumeInput.value = this.defaultVolumeSlider.value;
        
        // Save to localStorage
        localStorage.setItem('defaultVolume', volume.toString());
        
        // Show notification
        this.showNotification(`Default volume set to ${this.defaultVolumeSlider.value}%`, 'fa-volume-up');
    }

    updateDefaultVolumeFromInput() {
        let value = parseInt(this.defaultVolumeInput.value);
        
        // Validate range
        if (value < 0) value = 0;
        if (value > 100) value = 100;
        
        this.defaultVolumeInput.value = value;
        this.defaultVolumeSlider.value = value;
        
        const volume = value / 100;
        
        // Save to localStorage
        localStorage.setItem('defaultVolume', volume.toString());
        
        // Show notification
        this.showNotification(`Default volume set to ${value}%`, 'fa-volume-up');
    }

    validateVolumeInput() {
        let value = parseInt(this.defaultVolumeInput.value);
        
        // Validate and correct if needed
        if (isNaN(value) || value < 0) {
            value = 0;
        } else if (value > 100) {
            value = 100;
        }
        
        this.defaultVolumeInput.value = value;
        this.defaultVolumeSlider.value = value;
        
        const volume = value / 100;
        localStorage.setItem('defaultVolume', volume.toString());
    }


    loadDefaultVolume() {
        const savedVolume = localStorage.getItem('defaultVolume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            this.volume = volume;
            this.audio.volume = volume;
            this.updateVolumeDisplay();
            
            // Update both slider and input field to match
            if (this.defaultVolumeSlider && this.defaultVolumeInput) {
                const volumePercent = Math.round(volume * 100);
                this.defaultVolumeSlider.value = volumePercent;
                this.defaultVolumeInput.value = volumePercent;
            }
        }
    }

    saveSettings() {
        const settings = {
            theme: this.currentTheme,
            performanceMode: this.performanceMode.checked,
            glassEffects: this.glassEffects.checked,
            animatedBg: this.animatedBg.checked,
            noHover: document.body.classList.contains('no-hover'),
            thickSongs: this.thickSongs.checked
        };
        localStorage.setItem('musicPlayerSettings', JSON.stringify(settings));
    }

    // Action Log: persistence
    saveActionLog() {
        try {
            localStorage.setItem('musicPlayerActions', JSON.stringify(this.actionLog));
        } catch (_) {}
    }

    loadActionLog() {
        try {
            const raw = localStorage.getItem('musicPlayerActions');
            if (raw) this.actionLog = JSON.parse(raw);
        } catch (_) { this.actionLog = []; }
    }

    loadSettings() {
        try {
            const settings = localStorage.getItem('musicPlayerSettings');
            if (settings) {
                const parsed = JSON.parse(settings);
                
                // Apply theme
                if (parsed.theme) {
                    this.currentTheme = parsed.theme;
                    document.body.setAttribute('data-theme', parsed.theme);
                } else {
                    // Set default theme if none saved
                    this.currentTheme = 'dark';
                    document.body.setAttribute('data-theme', 'dark');
                }
                
                // Update active button
                this.themeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.theme === this.currentTheme) {
                        btn.classList.add('active');
                    }
                });
                
                // Apply performance mode
                if (parsed.performanceMode !== undefined) {
                    this.performanceMode.checked = parsed.performanceMode;
                    this.togglePerformanceMode();
                }
                
                // Apply glass effects
                if (parsed.glassEffects !== undefined) {
                    this.glassEffects.checked = parsed.glassEffects;
                    this.toggleGlassEffects();
                }
                
                // Apply animated background
                if (parsed.animatedBg !== undefined) {
                    this.animatedBg.checked = parsed.animatedBg;
                    this.toggleAnimatedBackground();
                }
                
                // Apply hover setting
                if (parsed.noHover !== undefined) {
                    if (this.disableHover) this.disableHover.checked = !!parsed.noHover;
                    this.applyHoverEffectsSetting();
                }
                
                // Apply thick songs setting
                if (parsed.thickSongs !== undefined) {
                    this.thickSongs.checked = parsed.thickSongs;
                    this.toggleThickSongs();
                }
            } else {
                // No settings saved, apply defaults
                this.currentTheme = 'dark';
                document.body.setAttribute('data-theme', 'dark');
                this.themeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.theme === 'dark') {
                        btn.classList.add('active');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Apply defaults on error
            this.currentTheme = 'dark';
            document.body.setAttribute('data-theme', 'dark');
            this.themeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.theme === 'dark') {
                    btn.classList.add('active');
                }
            });
        }
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    // Storage Management
    saveToStorage() {
        // Persist only serializable metadata (exclude object URLs and File/Blob, but keep local file URLs)
        const sanitizeTracks = (tracks) => tracks.map(t => ({ 
            id: t.id, 
            name: t.name, 
            artist: t.artist,
            album: t.album,
            year: t.year,
            genre: t.genre,
            duration: t.duration || 0,
            album_art: t.album_art,
            album_art_mime: t.album_art_mime,
            url: t.isLocalFile ? t.url : null, // Preserve URL for local files
            isLocalFile: t.isLocalFile || false
        }));
        const data = {
            playlist: sanitizeTracks(this.playlist),
            customPlaylists: Array.from(this.customPlaylists.entries()).map(([id, pl]) => [id, {
                name: pl.name,
                cover: pl.cover,
                tracks: sanitizeTracks(pl.tracks || [])
            }]),
            currentPlaylistId: this.currentPlaylistId,
            volume: this.volume
        };
        localStorage.setItem('musicPlayer', JSON.stringify(data));
    }

    async loadFromStorage() {
        try {
            const data = localStorage.getItem('musicPlayer');
            if (data) {
                const parsed = JSON.parse(data);
                
                if (parsed.playlist) {
                    // Rehydrate playlist and reconstruct URLs asynchronously
                    this.playlist = parsed.playlist.map(t => ({
                        id: t.id,
                        name: t.name,
                        artist: t.artist,
                        album: t.album,
                        year: t.year,
                        genre: t.genre,
                        duration: t.duration || 0, 
                        url: t.url || null, // Restore URL for local files
                        album_art: t.album_art,
                        album_art_mime: t.album_art_mime,
                        isLocalFile: t.isLocalFile || false
                    }));
                    // Preload object URLs in background and track which are in IndexedDB
                    Promise.all(this.playlist.map(async (t) => {
                        if (t.id && !t.isLocalFile) {
                            t.url = await this.db.getObjectUrl(t.id);
                            // If we got a URL, it means the file is in IndexedDB
                            if (t.url) {
                                this.db.indexedDBKeys.add(t.id);
                        }
                        }
                    })).then(async () => {
                        this.renderPlaylist();
                        // Load the first track if there are tracks
                        if (this.playlist.length > 0) {
                            console.log('Loading first track after refresh...');
                            await this.loadTrack(0);
                            // Ensure the audio element is ready for playback
                            this.audio.load();
                            console.log('First track loaded, audio element ready');
                        }
                        // Fetch durations for tracks that don't have it yet
                        this.playlist.forEach(t => {
                            if (t.url && (!t.duration || t.duration === 0)) {
                                this.preloadTrackMetadata(t).catch(() => {});
                            }
                        });
                        // Update storage status after loading
                        this.updateStorageStatus();
                    }).catch(() => {});
                }
                
                if (parsed.customPlaylists) {
                    // Rehydrate custom playlists
                    const rebuilt = new Map();
                    parsed.customPlaylists.forEach(([id, pl]) => {
                        const tracks = (pl.tracks || []).map(t => ({ 
                            id: t.id, 
                            name: t.name, 
                            artist: t.artist,
                            album: t.album,
                            year: t.year,
                            genre: t.genre,
                            duration: t.duration || 0, 
                            url: null,
                            album_art: t.album_art,
                            album_art_mime: t.album_art_mime
                        }));
                        rebuilt.set(id, { name: pl.name, cover: pl.cover, tracks });
                    });
                    this.customPlaylists = rebuilt;
                }
                
                if (parsed.currentPlaylistId) {
                    this.currentPlaylistId = parsed.currentPlaylistId;
                }
                
                if (parsed.volume !== undefined) {
                    this.volume = parsed.volume;
                    this.audio.volume = this.volume;
                    this.updateVolumeDisplay();
                }
                
                this.renderPlaylistTabs();
                this.renderPlaylist();
                // If there is a track, attempt to load first one (URL may be set once rehydrated)
                const list = this.getCurrentPlaylist();
                if (list.length > 0) {
                    this.loadTrack(0);
                }
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }

    // Helper: Preload metadata to obtain duration without playing
    preloadTrackMetadata(track) {
        return new Promise((resolve) => {
            try {
                if (!track || !track.url) { resolve(); return; }
                const tempAudio = new Audio();
                tempAudio.preload = 'metadata';
                const cleanup = () => {
                    tempAudio.removeEventListener('loadedmetadata', onLoaded);
                    tempAudio.removeEventListener('error', onError);
                    // Do not set src to empty for object URLs we still use elsewhere
                };
                const onLoaded = () => {
                    const duration = Number.isFinite(tempAudio.duration) ? tempAudio.duration : 0;
                    if (duration && duration > 0) {
                        track.duration = duration;
                        this.renderPlaylist();
                        this.saveToStorage();
                    }
                    cleanup();
                    resolve();
                };
                const onError = () => { cleanup(); resolve(); };
                tempAudio.addEventListener('loadedmetadata', onLoaded, { once: true });
                tempAudio.addEventListener('error', onError, { once: true });
                // Trigger metadata load
                tempAudio.src = track.url;
            } catch (_) { resolve(); }
        });
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    toggleTrackSelection(index) {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }
    }

    clearSelection() {
        this.selectedTracks.clear();
        this.isMultiSelecting = false; // Reset multi-select mode
    }

    getSelectedTracks() {
        const currentPlaylist = this.getCurrentPlaylist();
        return Array.from(this.selectedTracks)
            .filter(index => index >= 0 && index < currentPlaylist.length)
            .map(index => ({ index, track: currentPlaylist[index] }));
    }

    showConfirmDialog(message, callback) {
        this.confirmDialogMessage.textContent = message;
        this.confirmDialogCallback = callback;
        this.confirmDialogOverlay.classList.add('show');
        
        // Focus the cancel button for accessibility
        setTimeout(() => {
            this.confirmDialogCancel.focus();
        }, 100);
    }

    hideConfirmDialog() {
        this.confirmDialogOverlay.classList.remove('show');
        this.confirmDialogCallback = null;
    }

    executeConfirmDialogCallback() {
        if (this.confirmDialogCallback) {
            this.confirmDialogCallback();
        }
        this.hideConfirmDialog();
    }



    // Heuristic: treat as audio if MIME says audio/* or filename has a common audio extension
    isProbablyAudioFile(file) {
        try {
            if (!file) return false;
            if (file.type && file.type.startsWith('audio/')) return true;
            const name = (file.name || '').toLowerCase();
            const exts = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wma'];
            return exts.some(ext => name.endsWith(ext));
        } catch (_) {
            return false;
        }
    }

    // Extract metadata using Web APIs (client-side) with Python backend fallback
    async extractMetadataFromPython(file) {
        try {
            // First try Python backend if available (for local development)
            try {
                const response = await fetch('/extract-metadata', {
                    method: 'POST',
                    headers: {
                        'X-Filename': file.name
                    },
                    body: file
                });
                
                if (response.ok) {
                    const metadata = await response.json();
                    if (!metadata.error) {
                        return {
                            title: metadata.title,
                            artist: metadata.artist,
                            album: metadata.album,
                            year: metadata.year,
                            genre: metadata.genre,
                            track_number: metadata.track_number,
                            duration: metadata.duration,
                            extraction_method: metadata.extraction_method,
                            album_art: metadata.album_art,
                            album_art_mime: metadata.album_art_mime
                        };
                    }
                }
            } catch (backendError) {
                console.log('Python backend not available, using client-side extraction');
            }

            // Fallback to client-side metadata extraction
            console.log('Using client-side metadata extraction for file:', file.name);
            return await this.extractMetadataClientSide(file);
        } catch (error) {
            console.warn('Metadata extraction failed:', error);
            return null;
        }
    }

    // Client-side metadata extraction using Web APIs
    async extractMetadataClientSide(file) {
        try {
            console.log('Starting client-side metadata extraction for:', file.name, 'Size:', file.size);
            
            const metadata = {
                title: null,
                artist: null,
                album: null,
                year: null,
                genre: null,
                track_number: null,
                duration: null,
                album_art: null,
                album_art_mime: null,
                file_name: file.name,
                file_size: file.size,
                extraction_method: 'client-side'
            };

            // Create audio element to get duration
            const audio = new Audio();
            const durationPromise = new Promise((resolve) => {
                audio.addEventListener('loadedmetadata', () => {
                    resolve(audio.duration || 0);
                });
                audio.addEventListener('error', () => resolve(0));
                // Timeout after 5 seconds
                setTimeout(() => resolve(0), 5000);
            });

            // Load file for duration
            audio.src = URL.createObjectURL(file);
            metadata.duration = await durationPromise;
            URL.revokeObjectURL(audio.src);

            // Try to extract metadata from filename
            const filenameMetadata = this.parseFilenameMetadata(file.name);
            console.log('Filename metadata extracted:', filenameMetadata);
            Object.assign(metadata, filenameMetadata);

            // Try to extract ID3 tags if it's an MP3 file
            if (file.name.toLowerCase().endsWith('.mp3')) {
                try {
                    const id3Metadata = await this.extractID3Tags(file);
                    if (id3Metadata) {
                        Object.assign(metadata, id3Metadata);
                    }
                } catch (id3Error) {
                    console.log('ID3 extraction failed:', id3Error);
                }
            }

            console.log('Final metadata extracted:', metadata);
            return metadata;
        } catch (error) {
            console.warn('Client-side metadata extraction failed:', error);
            return null;
        }
    }

    // Parse metadata from filename
    parseFilenameMetadata(filename) {
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        const metadata = {};

        // Common patterns: "Artist - Song Title", "Artist - Album - Song Title", etc.
        const patterns = [
            /^(.+?)\s*-\s*(.+?)\s*-\s*(.+?)\s*\((\d{4})\)$/, // Artist - Album - Song (Year)
            /^(.+?)\s*-\s*(.+?)\s*-\s*(.+?)\s*\[(\d{4})\]$/, // Artist - Album - Song [Year]
            /^(.+?)\s*-\s*(.+?)\s*-\s*(.+)$/, // Artist - Album - Song
            /^(.+?)\s*-\s*(.+?)\s*\((\d{4})\)$/, // Artist - Song (Year)
            /^(.+?)\s*-\s*(.+?)\s*\[(\d{4})\]$/, // Artist - Song [Year]
            /^(.+?)\s*-\s*(.+)$/, // Artist - Song
            /^(.+?)_(.+)$/ // Artist_Song
        ];

        for (const pattern of patterns) {
            const match = nameWithoutExt.match(pattern);
            if (match) {
                const groups = match.slice(1);
                if (groups.length === 2) {
                    metadata.artist = groups[0].trim();
                    metadata.title = groups[1].trim();
                } else if (groups.length === 3) {
                    if (/\d{4}/.test(groups[2])) {
                        // Has year
                        metadata.artist = groups[0].trim();
                        metadata.title = groups[1].trim();
                        metadata.year = groups[2].trim();
                    } else {
                        // Has album
                        metadata.artist = groups[0].trim();
                        metadata.album = groups[1].trim();
                        metadata.title = groups[2].trim();
                    }
                } else if (groups.length === 4) {
                    metadata.artist = groups[0].trim();
                    metadata.album = groups[1].trim();
                    metadata.title = groups[2].trim();
                    metadata.year = groups[3].trim();
                }
                break;
            }
        }

        // If no pattern matched, use the whole filename as title
        if (!metadata.title) {
            metadata.title = nameWithoutExt;
        }

        return metadata;
    }

    // Extract ID3 tags from MP3 files (basic implementation)
    async extractID3Tags(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Look for ID3v2 tag (starts with "ID3")
            let offset = 0;
            while (offset < uint8Array.length - 10) {
                if (uint8Array[offset] === 0x49 && uint8Array[offset + 1] === 0x44 && uint8Array[offset + 2] === 0x33) {
                    // Found ID3v2 tag
                    const tagSize = ((uint8Array[offset + 6] & 0x7F) << 21) |
                                   ((uint8Array[offset + 7] & 0x7F) << 14) |
                                   ((uint8Array[offset + 8] & 0x7F) << 7) |
                                   (uint8Array[offset + 9] & 0x7F);
                    
                    const tagData = uint8Array.slice(offset + 10, offset + 10 + tagSize);
                    return this.parseID3v2Tag(tagData);
                }
                offset++;
            }
            
            return null;
        } catch (error) {
            console.warn('ID3 tag extraction failed:', error);
            return null;
        }
    }

    // Parse ID3v2 tag data (simplified)
    parseID3v2Tag(tagData) {
        const metadata = {};
        let offset = 0;

        while (offset < tagData.length - 10) {
            // Read frame header
            const frameId = String.fromCharCode(...tagData.slice(offset, offset + 4));
            const frameSize = (tagData[offset + 4] << 24) | 
                             (tagData[offset + 5] << 16) | 
                             (tagData[offset + 6] << 8) | 
                             tagData[offset + 7];
            
            if (frameSize <= 0 || frameSize > tagData.length - offset - 10) {
                break;
            }

            const frameData = tagData.slice(offset + 10, offset + 10 + frameSize);
            
            // Parse common frames
            switch (frameId) {
                case 'TIT2': // Title
                    metadata.title = this.decodeID3Text(frameData);
                    break;
                case 'TPE1': // Artist
                    metadata.artist = this.decodeID3Text(frameData);
                    break;
                case 'TALB': // Album
                    metadata.album = this.decodeID3Text(frameData);
                    break;
                case 'TYER': // Year
                case 'TDRC': // Date
                    metadata.year = this.decodeID3Text(frameData);
                    break;
                case 'TCON': // Genre
                    metadata.genre = this.decodeID3Text(frameData);
                    break;
                case 'TRCK': // Track number
                    metadata.track_number = this.decodeID3Text(frameData);
                    break;
            }
            
            offset += 10 + frameSize;
        }

        return metadata;
    }

    // Decode ID3 text frame
    decodeID3Text(frameData) {
        if (frameData.length === 0) return '';
        
        // Skip encoding byte (first byte)
        const encoding = frameData[0];
        const textData = frameData.slice(1);
        
        try {
            if (encoding === 0 || encoding === 3) {
                // ISO-8859-1 or UTF-8
                return new TextDecoder('utf-8').decode(textData).replace(/\0/g, '');
            } else if (encoding === 1) {
                // UTF-16 with BOM
                return new TextDecoder('utf-16').decode(textData).replace(/\0/g, '');
            } else if (encoding === 2) {
                // UTF-16BE without BOM
                return new TextDecoder('utf-16be').decode(textData).replace(/\0/g, '');
            }
        } catch (error) {
            // Fallback to simple string conversion
            return String.fromCharCode(...textData).replace(/\0/g, '');
        }
        
        return String.fromCharCode(...textData).replace(/\0/g, '');
    }
}

// Initialize the music player when the page loads
let musicPlayer;
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Initializing app...');
    
    const db = new MusicDB();
    try {
        await db.open();
        console.log('Database initialized successfully');
    } catch (e) {
        console.error('IndexedDB initialization failed:', e);
        // Continue anyway - the app can still work with fallback storage
    }
    musicPlayer = new MusicPlayer(db);
    window.musicPlayer = musicPlayer; // Make globally available
    console.log('Music player initialized');
    musicPlayer.loadActionLog();

    // Initialize live system clock
    (function initSystemClock() {
        const clockEl = document.getElementById('systemClock');
        if (!clockEl) return;
        const formatter = new Intl.DateTimeFormat(undefined, {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            weekday: 'short', day: '2-digit', month: 'short'
        });
        const update = () => {
            try {
                const now = new Date();
                clockEl.textContent = formatter.format(now);
            } catch (err) {
                // Fallback if Intl fails
                const now = new Date();
                clockEl.textContent = now.toLocaleTimeString();
            }
        };
        update();
        setInterval(update, 1000);
    })();
});

// Add some visual effects
document.addEventListener('DOMContentLoaded', () => {
    // Add ripple effect to buttons (excluding upload buttons)
    document.querySelectorAll('.control-btn, .new-playlist-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Version: v5.2.0
