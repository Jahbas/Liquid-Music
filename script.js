class MusicPlayer {
    constructor() {
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
        
        this.initializeElements();
        this.bindEvents();
        this.setupAudio();
        this.loadFromStorage();
        this.loadSettings();
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
        
        // Theme buttons
        this.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.changeTheme(btn.dataset.theme));
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
    }

    setupAudio() {
        this.audio.volume = this.volume;
        this.audio.preload = 'metadata';
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.type.startsWith('audio/')) {
                this.addTrackToPlaylist(file);
            }
        });
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
    }

    handleFolderUpload(event) {
        const files = Array.from(event.target.files);
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        if (audioFiles.length === 0) {
            alert('No audio files found in the selected folder.');
            return;
        }
        
        audioFiles.forEach(file => {
            this.addTrackToPlaylist(file);
        });
        
        // Clear the input
        event.target.value = '';
    }

    addTrackToPlaylist(file) {
        const track = {
            file: file,
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            url: URL.createObjectURL(file),
            duration: 0
        };
        
        this.playlist.push(track);
        this.renderPlaylist();
        this.saveToStorage();
        
        // If this is the first track, load it
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

        this.playlistEl.innerHTML = currentPlaylist.map((track, index) => `
            <div class="playlist-item ${index === this.currentTrackIndex ? 'active' : ''}" 
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
        `).join('');

        // Add click events to playlist items
        this.playlistEl.querySelectorAll('.playlist-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-item-remove')) {
                    this.loadTrack(index);
                }
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
        });
    }

    switchPlaylist(playlistId) {
        this.currentPlaylistId = playlistId;
        this.currentTrackIndex = 0;
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
        }
    }

    clearPlaylist() {
        const currentPlaylist = this.getCurrentPlaylist();
        
        // Revoke all object URLs
        currentPlaylist.forEach(track => {
            URL.revokeObjectURL(track.url);
        });
        
        currentPlaylist.length = 0;
        this.currentTrackIndex = 0;
        this.stop();
        this.renderPlaylist();
        this.updateTrackInfo('No track selected', 'Upload music to get started');
        this.saveToStorage();
    }

    loadTrack(index) {
        const currentPlaylist = this.getCurrentPlaylist();
        if (index < 0 || index >= currentPlaylist.length) return;
        
        this.currentTrackIndex = index;
        const track = currentPlaylist[index];
        
        this.audio.src = track.url;
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
        }
    }

    updateTrackInfo(title, artist) {
        this.trackTitle.textContent = title;
        this.trackArtist.textContent = artist;
    }

    handleAudioError(error) {
        console.error('Audio error:', error);
    }

    handleKeyboard(event) {
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
    }

    deletePlaylist(playlistId) {
        if (confirm('Are you sure you want to delete this playlist?')) {
            const playlist = this.customPlaylists.get(playlistId);
            if (playlist) {
                // Revoke all object URLs
                playlist.tracks.forEach(track => {
                    URL.revokeObjectURL(track.url);
                });
            }
            
            this.customPlaylists.delete(playlistId);
            
            // Switch to current queue if we were viewing the deleted playlist
            if (this.currentPlaylistId === playlistId) {
                this.switchPlaylist('current');
            }
            
            this.renderPlaylistTabs();
            this.saveToStorage();
        }
    }

    // Settings Management
    toggleSettings() {
        this.settingsContent.classList.toggle('active');
    }

    hideSettings() {
        this.settingsContent.classList.remove('active');
    }

    changeTheme(theme) {
        // Remove existing theme classes
        document.body.classList.remove('dark-theme', 'light-theme', 'purple-theme', 'blue-theme');
        
        // Add new theme class
        if (theme !== 'dark') {
            document.body.classList.add(theme + '-theme');
        }
        
        // Update active theme button
        this.themeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });
        
        this.saveSettings();
    }

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

    saveSettings() {
        const settings = {
            theme: this.getCurrentTheme(),
            performanceMode: this.performanceMode.checked,
            glassEffects: this.glassEffects.checked,
            animatedBg: this.animatedBg.checked
        };
        localStorage.setItem('musicPlayerSettings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const settings = localStorage.getItem('musicPlayerSettings');
            if (settings) {
                const parsed = JSON.parse(settings);
                
                // Apply theme
                if (parsed.theme) {
                    this.changeTheme(parsed.theme);
                }
                
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
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    getCurrentTheme() {
        if (document.body.classList.contains('light-theme')) return 'light';
        if (document.body.classList.contains('purple-theme')) return 'purple';
        if (document.body.classList.contains('blue-theme')) return 'blue';
        return 'dark';
    }

    // Storage Management
    saveToStorage() {
        const data = {
            playlist: this.playlist,
            customPlaylists: Array.from(this.customPlaylists.entries()),
            currentPlaylistId: this.currentPlaylistId,
            volume: this.volume
        };
        localStorage.setItem('musicPlayer', JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('musicPlayer');
            if (data) {
                const parsed = JSON.parse(data);
                
                if (parsed.playlist) {
                    this.playlist = parsed.playlist;
                }
                
                if (parsed.customPlaylists) {
                    this.customPlaylists = new Map(parsed.customPlaylists);
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
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize the music player when the page loads
let musicPlayer;
document.addEventListener('DOMContentLoaded', () => {
    musicPlayer = new MusicPlayer();
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