// Simple IndexedDB wrapper for storing audio blobs persistently
class MusicDB {
    constructor() {
        this.db = null;
    }

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('musicPlayerDB', 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tracks')) {
                    db.createObjectStore('tracks', { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    saveFile(file) {
        return new Promise((resolve, reject) => {
            const id = 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const tx = this.db.transaction('tracks', 'readwrite');
            const store = tx.objectStore('tracks');
            store.put({ id, blob: file });
            tx.oncomplete = () => resolve(id);
            tx.onerror = () => reject(tx.error);
        });
    }

    getFile(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tracks', 'readonly');
            const store = tx.objectStore('tracks');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result?.blob || null);
            req.onerror = () => reject(req.error);
        });
    }

    async getObjectUrl(id) {
        const blob = await this.getFile(id);
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
        
        // Set default theme if none is loaded
        if (!document.body.getAttribute('data-theme')) {
            document.body.setAttribute('data-theme', 'glass');
        }
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
        
        // Progress elements
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.progressHandle = document.getElementById('progressHandle');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        
        // Volume elements
        this.volumeBar = document.getElementById('volumeBar');
        this.volumeProgress = document.getElementById('volumeProgress');
        this.volumeHandle = document.getElementById('volumeHandle');
        
        // Track info elements
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        this.albumArt = document.getElementById('albumArt');
        
        // Playlist elements
        this.playlistEl = document.getElementById('playlist');
        this.playlistTabs = document.getElementById('playlistTabs');
        this.fileInput = document.getElementById('fileInput');
        this.folderInput = document.getElementById('folderInput');
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
        this.themeButtons = document.querySelectorAll('.theme-btn');
        this.currentTheme = 'glass';

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
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.folderInput.addEventListener('change', (e) => this.handleFolderUpload(e));
        
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
                this.showConfirmModal('Do you want to join our Discord server?', 'joinDiscord');
            });
        }

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
        const files = Array.from(event.target.files);
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                await this.addTrackToPlaylist(file);
            }
        }
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
    }

    async handleFolderUpload(event) {
        const files = Array.from(event.target.files);
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        if (audioFiles.length === 0) {
            // Silently return if no audio files are present
            return;
        }
        
        for (const file of audioFiles) {
            await this.addTrackToPlaylist(file);
        }
        
        // Clear the input
        event.target.value = '';
    }

    async addTrackToPlaylist(file, addToTop = false) {
        const id = await this.db.saveFile(file);
        const track = {
            id: id,
            name: file.name.replace(/\.[^/.]+$/, ""),
            url: URL.createObjectURL(file), // immediate playback without waiting for IDB
            duration: 0
        };

        if (addToTop) {
            this.playlist.unshift(track);
        } else {
            this.playlist.push(track);
        }
        this.renderPlaylist();
        this.saveToStorage();

        // Preload duration metadata so it shows without needing to play
        this.preloadTrackMetadata(track).catch(() => {});

        this.pushAction('track_add', { targetId: 'current', targetLabel: 'Queue', tracks: [{ id: track.id, name: track.name }], count: 1 }, true);

        if (this.playlist.length === 1) {
            this.loadTrack(0);
        }
    }

    renderPlaylist() {
        const currentPlaylist = this.getCurrentPlaylist();
        
        if (currentPlaylist.length === 0) {
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
                    <div class="playlist-item-title">${track.name}</div>
                    <div class="playlist-item-artist">Unknown Artist</div>
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
        const currentPlaylist = this.getCurrentPlaylist();
        if (index < 0 || index >= currentPlaylist.length) return;
        
        this.currentTrackIndex = index;
        const track = currentPlaylist[index];

        if (!track.url && track.id) {
            // Reconstruct object URL from IndexedDB on demand
            track.url = await this.db.getObjectUrl(track.id);
        }

        if (track.url) {
            this.audio.src = track.url;
        }
        this.updateTrackInfo(track.name, 'Unknown Artist');
        this.renderPlaylist();
        
        // Load metadata
        this.audio.load();
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
        } else {
            this.audio.volume = this.volume;
            this.updateVolumeButton();
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

    updateTrackInfo(title, artist) {
        this.trackTitle.textContent = title;
        this.trackArtist.textContent = artist;
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

    // Action Log: UI
    showLogs() {
        this.renderLogs();
        this.logsModal.classList.add('active');
    }

    hideLogs() {
        this.logsModal.classList.remove('active');
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
            case 'playlist_create': return `Created playlist “${action.data.name}”`;
            case 'playlist_delete': return `Deleted playlist “${action.data.name}”`;
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
        this.showNotification(`Undid: created playlist “${action.data.name}”`, 'fa-undo');
    }

    undoDeletePlaylist(action) {
        const { id, name, cover, tracks } = action.data;
        if (this.customPlaylists.has(id)) return;
        this.customPlaylists.set(id, { name, cover, tracks });
        this.renderPlaylistTabs();
        this.saveToStorage();
        this.showNotification(`Undid: deleted playlist “${name}”`, 'fa-undo');
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
            arr.splice(Math.min(t.index, arr.length), 0, { id: t.id, name: t.name, url: null, duration: 0 });
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
        } else if (event.code === 'KeyM') {
            event.preventDefault();
            this.toggleMute();
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
    }

    hideSettings() {
        this.settingsContent.classList.remove('active');
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

    toggleAnimatedBackground() {
        if (this.animatedBg.checked) {
            document.body.classList.remove('no-bg');
        } else {
            document.body.classList.add('no-bg');
        }
        this.saveSettings();
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
        const themeName = theme === 'glass' ? 'Glass' : 'Dark';
        this.showNotification(`Switched to ${themeName} theme`, 'fa-palette');
    }

    saveSettings() {
        const settings = {
            theme: this.currentTheme,
            performanceMode: this.performanceMode.checked,
            glassEffects: this.glassEffects.checked,
            animatedBg: this.animatedBg.checked
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
                    this.currentTheme = 'glass';
                    document.body.setAttribute('data-theme', 'glass');
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
            } else {
                // No settings saved, apply defaults
                this.currentTheme = 'glass';
                document.body.setAttribute('data-theme', 'glass');
                this.themeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.theme === 'glass') {
                        btn.classList.add('active');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Apply defaults on error
            this.currentTheme = 'glass';
            document.body.setAttribute('data-theme', 'glass');
            this.themeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.theme === 'glass') {
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
        // Persist only serializable metadata (exclude object URLs and File/Blob)
        const sanitizeTracks = (tracks) => tracks.map(t => ({ id: t.id, name: t.name, duration: t.duration || 0 }));
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
                    this.playlist = parsed.playlist.map(t => ({ id: t.id, name: t.name, duration: t.duration || 0, url: null }));
                    // Preload object URLs in background
                    Promise.all(this.playlist.map(async (t) => {
                        if (t.id) {
                            t.url = await this.db.getObjectUrl(t.id);
                        }
                    })).then(() => {
                        this.renderPlaylist();
                        // Fetch durations for tracks that don't have it yet
                        this.playlist.forEach(t => {
                            if (t.url && (!t.duration || t.duration === 0)) {
                                this.preloadTrackMetadata(t).catch(() => {});
                            }
                        });
                    }).catch(() => {});
                }
                
                if (parsed.customPlaylists) {
                    // Rehydrate custom playlists
                    const rebuilt = new Map();
                    parsed.customPlaylists.forEach(([id, pl]) => {
                        const tracks = (pl.tracks || []).map(t => ({ id: t.id, name: t.name, duration: t.duration || 0, url: null }));
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
}

// Initialize the music player when the page loads
let musicPlayer;
document.addEventListener('DOMContentLoaded', async () => {
    const db = new MusicDB();
    try {
        await db.open();
    } catch (e) {
        console.error('IndexedDB initialization failed:', e);
    }
    musicPlayer = new MusicPlayer(db);
    musicPlayer.loadActionLog();
});

// Add some visual effects
document.addEventListener('DOMContentLoaded', () => {
    // Add ripple effect to buttons
    document.querySelectorAll('.control-btn, .upload-btn, .new-playlist-btn').forEach(button => {
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

// Version: v2.2.3
