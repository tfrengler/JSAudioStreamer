import { JSUtils } from "./Utils.js";

export class UI_Controller {

    constructor(serviceLocator) {

        this.services = serviceLocator || null;
        this.elements = Object.create(null);
        this.librarySearchTextThreshold = 3;

        this.selectors = Object.freeze({
            AlbumListTrack: "input[data-trackid]",
            PlaylistCurrentlyPlaying: ".Playing",
            LibrarySelectAllAlbum: "a.SelectAllInAlbum",
            LibraryDeSelectAllAlbum: "a.DeselectAllInAlbum",
            LibraryToggleAlbum: "a.ToggleAlbum",
            LibrarySelectAllArtist: "a.SelectAllInArtist",
            LibraryDeSelectAllArtist: "a.DeselectAllInArtist",
            LibraryToggleArtist: "a.ToggleArtist",
            LibraryArtistSelectedCount: "span.ArtistSelectedCount",
            LibraryAlbumSelectedCount: "span.AlbumSelectedCount",
            LibraryAlbumTrackListContainer: "ol.AlbumTrackList",
            LibraryAlbumListContainer: "section.AlbumList",
            LibraryAlbumContainer: ".Album"
        });

        console.log("UI Controller instantiated" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    init() {

        this.elements.InfoLog                       = document.getElementById("LogOutput");
        
        // Library
        this.elements.UI_LibraryList                = document.getElementById("LibraryList");
        this.elements.UI_LibrarySearchText          = document.getElementById("LibrarySearchText");
        this.elements.UI_SearchLibrary              = document.getElementById("SearchLibrary");
        this.elements.UI_LibrarySearchOnTitle       = document.getElementById("LibrarySearchOnTitle");
        this.elements.UI_LibrarySearchOnArtist      = document.getElementById("LibrarySearchOnArtist");
        this.elements.UI_LibrarySearchOnAlbum       = document.getElementById("LibrarySearchOnAlbum");
        this.elements.UI_LibrarySearchOnGenre       = document.getElementById("LibrarySearchOnGenre");
        this.elements.UI_ResetLibrary               = document.getElementById("ResetLibrary");
        this.elements.UI_SelectAllInLibrary         = document.getElementById("SelectAllInLibrary");
        
        // Misc
        this.elements.UI_LibraryControlForm         = document.querySelector("*[name='LibraryControlForm']");
        this.elements.UI_AlbumList                  = document.getElementById("AlbumList");
        this.elements.UI_Playlist                   = document.getElementById("PlaylistBody"); // div
        this.elements.UI_LibraryShowHide            = document.getElementById("LibraryShowHide");

        // Player info
        this.elements.UI_Previous                   = document.getElementById("UI_Previous"); // button
        this.elements.UI_Play                       = document.getElementById("UI_Play"); // button
        this.elements.UI_Pause                      = document.getElementById("UI_Pause"); // button
        this.elements.UI_Mute                       = document.getElementById("UI_Mute"); // button
        this.elements.UI_Next                       = document.getElementById("UI_Next"); // button
        this.elements.UI_Volume                     = document.getElementById("UI_Volume"); // span
        this.elements.UI_Volume_Slider              = document.getElementById("UI_Volume_Slider"); // input range
        this.elements.UI_Player_State               = document.getElementById("UI_Player_State"); // span
        this.elements.UI_PlayCursor                 = document.getElementById("UI_PlayCursor"); // td
        this.elements.UI_Player_Duration            = document.getElementById("UI_Player_Duration"); // td
        this.elements.UI_Buffered_Until             = document.getElementById("UI_Buffered_Until"); // td
        this.elements.UI_Buffer_Tail                = document.getElementById("UI_Buffer_Tail"); // td
        this.elements.UI_Audio_Buffer               = document.getElementById("UI_Audio_Buffer"); // meter
        this.elements.UI_Audio_Buffer_Limit         = document.getElementById("UI_Audio_Buffer_Limit"); // span
        this.elements.UI_Datastream_Progress        = document.getElementById("UI_Datastream_Progress"); // progress
        this.elements.UI_Datastream_BytesRead       = document.getElementById("UI_Datastream_BytesRead"); // span
        this.elements.UI_Datastream_BytesExpected   = document.getElementById("UI_Datastream_BytesExpected"); // td
        this.elements.UI_AudioObject_State          = document.getElementById("UI_AudioObject_State"); // td
        this.elements.UI_Datastream_State           = document.getElementById("UI_Datastream_State"); // td

        // Track Info
        this.elements.UI_TrackID                    = document.getElementById("UI_TrackID"); // td
        this.elements.UI_Title                      = document.getElementById("UI_Title"); // td
        this.elements.UI_Album                      = document.getElementById("UI_Album"); // td
        this.elements.UI_TrackArtists               = document.getElementById("UI_TrackArtists"); // td
        this.elements.UI_Year                       = document.getElementById("UI_Year"); // td
        this.elements.UI_Genres                     = document.getElementById("UI_Genres"); // td
        this.elements.UI_Duration                   = document.getElementById("UI_Duration"); // td
        this.elements.UI_Mimetype                   = document.getElementById("UI_Mimetype"); // td
        this.elements.UI_Size                       = document.getElementById("UI_Size"); // td
        this.elements.UI_ReplayGain                 = document.getElementById("UI_ReplayGain"); // td

        // Playlist
        this.elements.UI_ShowHidePlaylist           = document.getElementById("ShowHidePlayList");
        this.elements.UI_ClearPlaylist              = document.getElementById("ClearPlaylist");
        
        let player = this.services.get("player");

        this.elements.UI_Playlist.style.maxHeight = (window.innerHeight - 100) + "px";
        this.elements.UI_Audio_Buffer_Limit.textContent = JSUtils.getReadableBytes(player.CHROME_SOURCEBUFFER_LIMIT);
        this.elements.UI_Audio_Buffer.max = player.CHROME_SOURCEBUFFER_LIMIT;
        this.elements.UI_Audio_Buffer.low = parseInt(player.CHROME_SOURCEBUFFER_LIMIT * 0.50);
        this.elements.UI_Audio_Buffer.high = parseInt(player.CHROME_SOURCEBUFFER_LIMIT * 0.75);

        this.elements.UI_LibrarySearchOnTitle.value = this.services.get("indexes").FILTER.TITLE;
        this.elements.UI_LibrarySearchOnArtist.value = this.services.get("indexes").FILTER.ARTIST;
        this.elements.UI_LibrarySearchOnAlbum.value = this.services.get("indexes").FILTER.ALBUM;
        this.elements.UI_LibrarySearchOnGenre.value = this.services.get("indexes").FILTER.GENRE;

        Object.freeze(this.elements);
        this._initEventHandlers();

        console.log(`UI Controller initialized, with ${Object.keys(this.elements).length} element-handles`);
    }

    _initEventHandlers() {
        let player = this.services.get("player");
        let playlist = this.services.get("playlist");
        let events = this.services.get("events");

        document.querySelector("html").addEventListener("keyup", (event)=> {
            if (event.key !== "Delete") return;

            let selectedPlaylistEntries = document.querySelectorAll("div.Selected");
            if (selectedPlaylistEntries.length)
                this.services.get("playlist").remove(Array.from(selectedPlaylistEntries).map((playlistEntry)=> playlistEntry.dataset.trackid));
        });

        // Player interaction handlers
        this.elements.UI_Play.addEventListener("click", player.play.bind(player));
        this.elements.UI_Pause.addEventListener("click", player.pause.bind(player));

        this.elements.UI_Previous.addEventListener("click", ()=> {
            let previousTrack = playlist.getPrevious();
            if (previousTrack)
                player.loadNextTrack(previousTrack, true);
        });

        this.elements.UI_Next.addEventListener("click", ()=> {
            let nextTrack = playlist.getNext();
            if (nextTrack)
                player.loadNextTrack(nextTrack, true);
        });
        
        this.elements.UI_Mute.addEventListener("click", ()=> {
            player.mute();
            this.elements.UI_Mute.innerHTML = `${player.audioElement.muted ? "<b>UN-MUTE</b>" : "MUTE"}`;
        });
        
        this.elements.UI_Volume_Slider.addEventListener("change", (event)=> {
            player.setVolume(event.srcElement.value);
            this.elements.UI_Volume.textContent = (event.srcElement.value * 100) + "%";
        });

        /* Info read-out handlers */
        player.audioElement.addEventListener("timeupdate", ()=> this.elements.UI_PlayCursor.textContent = JSUtils.getReadableTime(player.audioElement.currentTime));

        events.manager.subscribe(events.types.ERROR, this._onError, this);
        // MEDIA_CONTROLLER
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Loading next track (${eventData.trackID} | ${eventData.rotateImmediately})`);
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PREPARING_NEXT_TRACK, function() {
            JSUtils.Log(this.elements.InfoLog, "Preparing next track for future playback");
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE, function() {
            JSUtils.Log(this.elements.InfoLog, "Loaded track is playable");
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_METADATA_LOADED, function() {
            JSUtils.Log(this.elements.InfoLog, "Metadata loaded");
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_BUFFERING_AHEAD, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Asking audio object to buffer ahead (${eventData.seconds} seconds)`);
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ENDED, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Playback for current track ended (next track: ${eventData.trackID_next ? eventData.trackID_next : "none"})`)
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PLAYING, function() {
            JSUtils.Log(this.elements.InfoLog, "Playback starting");
            this.elements.UI_Player_State.textContent = "PLAYING..."
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PAUSED, function() {
            JSUtils.Log(this.elements.InfoLog, "Playback paused");
            this.elements.UI_Player_State.textContent = "PAUSED"
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_MUTED, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Playback ${eventData.muted ? "muted" : "unmuted"}`);
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_DURATION_CHANGED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Duration changed for loaded track (${eventData.duration})`);
            this.elements.UI_Player_Duration.textContent = JSUtils.getReadableTime(eventData.duration)
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_WAITING, function(){
            JSUtils.Log(this.elements.InfoLog, `Waiting, possibly due to latency or buffering being behind`, "WARNING");
            this.elements.UI_Player_State.textContent = "WAITING...";
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_STALLED, function(){
            JSUtils.Log(this.elements.InfoLog, `Playback stalled, due to lack of data`, "WARNING");
            this.elements.UI_Player_State.textContent = "STALLED!";
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_GAIN_CHANGED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Gain for loaded track changed (${eventData.value} | ${eventData.decibels})`);
        }, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ROTATED, this._onTrackRotated, this);
        // AUDIO_OBJECT
        events.manager.subscribe(events.types.AUDIO_OBJECT_OPEN, function(){
            this.elements.UI_AudioObject_State.textContent = "OPEN";
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_READY, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Audio object is initialized and ready (${eventData.object_url})`);
            this.elements.UI_AudioObject_State.textContent = "READY";
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_COMPLETED, function(){
            JSUtils.Log(this.elements.InfoLog, `Audio object complete (stream read to completion)`);
            this.elements.UI_AudioObject_State.textContent = "COMPLETED";
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_DISPOSED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Audio object disposed, and is no longer usable (${eventData.object_url} | ${eventData.mediasource_state})`);
            this.elements.UI_AudioObject_State.textContent = "DISPOSED";
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFERING, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Audio object buffering... (mark: ${eventData.bufferMark})`);
            this.elements.UI_AudioObject_State.textContent = "BUFFERING";
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFER_UPDATED, function(data){
            this.elements.UI_Buffered_Until.textContent = JSUtils.getReadableTime(data.buffered_until);
            this.elements.UI_Buffer_Tail.textContent = JSUtils.getReadableTime(data.buffered_from);
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFER_MARK_REACHED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Audio object buffering complete (from ${eventData.from}, until ${eventData.until})`);
        }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_READ_ERROR, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Error while reading from datastream (attempt ${eventData.attempts} of ${eventData.maxAttempts})`, "WARNING");
        }, this);
        // DATA_STREAM
        events.manager.subscribe(events.types.DATA_STREAM_OPEN, function(){
            this.elements.UI_Datastream_State.textContent = "OPEN";
        }, this);
        events.manager.subscribe(events.types.DATA_STREAM_CLOSED, function(){
            JSUtils.Log(this.elements.InfoLog, `Data stream has been closed`);
            this.elements.UI_Datastream_State.textContent = "CLOSED";
        }, this);
        events.manager.subscribe(events.types.DATA_STREAM_READING, function(){
            this.elements.UI_Datastream_State.textContent = "READING";
        }, this);
        events.manager.subscribe(events.types.DATA_STREAM_CHUNK_RECEIVED, function(data){
            this.elements.UI_Datastream_BytesRead.textContent = JSUtils.getReadableBytes(data.bytes_total);
            this.elements.UI_Datastream_Progress.value = data.bytes_total;
            this.elements.UI_Audio_Buffer.value = data.bytes_total;
        }, this);

        // Library controls
        this.elements.UI_LibrarySearchText.addEventListener("input", (event)=> {
            if (event.srcElement.value.length >= this.librarySearchTextThreshold && this.elements.UI_SearchLibrary.disabled)
                this.elements.UI_SearchLibrary.disabled = false;
            else if (event.srcElement.value.length < this.librarySearchTextThreshold)
                this.elements.UI_SearchLibrary.disabled = true;
        });

        this.elements.UI_LibrarySearchText.addEventListener("keypress", (event)=> {
            if (event.key === "Enter")
                event.preventDefault();

            if (event.key === "Enter" && event.srcElement.value.length >= this.librarySearchTextThreshold)
                this._searchLibrary();
        });

        this.elements.UI_SearchLibrary.addEventListener("click", this._searchLibrary.bind(this));
        this.elements.UI_LibraryShowHide.addEventListener("change", ()=> {
            document.querySelectorAll(this.selectors.LibraryToggleArtist).forEach(element=> element.click());
        });

        this.elements.UI_ResetLibrary.addEventListener("click", ()=> this.elements.UI_LibraryList.innerHTML = "");
        this.elements.UI_SelectAllInLibrary.addEventListener("click", ()=> this._selectAllTracks(false));

        // Playlist
        this.elements.UI_ShowHidePlaylist.addEventListener("click", event=> {
            if (this.elements.UI_Playlist.style.display === "block") {
                this.elements.UI_Playlist.style.display = "none";
                event.srcElement.classList.remove("fa-eye-slash");
                event.srcElement.classList.add("fa-eye");
            }
            else {
                this.elements.UI_Playlist.style.display = "block";
                event.srcElement.classList.remove("fa-eye");
                event.srcElement.classList.add("fa-eye-slash");
            }
        });

        this.elements.UI_ClearPlaylist.addEventListener("click", ()=> {
            this._selectAllTracks(true);
            Array.from(this.elements.UI_Playlist.children).forEach(element=> element.remove());
            
            let playlist = this.services.get("playlist");
            
            if (playlist.count() > 0)
                playlist.clear();
        });

        events.manager.subscribe(events.types.PLAYLIST_TRACKS_ADDED, this._onTracksAddedToPlaylist.bind(this));
        events.manager.subscribe(events.types.PLAYLIST_TRACKS_REMOVED, this._onTracksRemovedFromPlaylist.bind(this));

        /* Index */
        events.manager.subscribe(events.types.INDEX_MANAGER_INDICES_BUILT, function() {
            this.elements.UI_LibrarySearchText.readOnly = false;
            this.elements.UI_LibrarySearchText.placeholder = "search";
        }, this);

        console.log("UI Controller: event handlers attached");
    }

    // UI handlers
    _onToggleAlbum(element) {
        let AlbumContainer = element.parentElement.parentElement;
        let AlbumList = AlbumContainer.querySelector(this.selectors.LibraryAlbumTrackListContainer);

        if (AlbumList.style.display === "block") {
            AlbumList.style.display = "none";
            element.textContent = "SHOW";
        }
        else {
            AlbumList.style.display = "block";
            element.textContent = "HIDE";
        }
    }

    _onToggleArtist(element) {
        let AlbumContainer = element.parentElement.parentElement;
        let AlbumList = AlbumContainer.querySelector(this.selectors.LibraryAlbumListContainer);

        if (AlbumList.style.display === "block") {
            AlbumList.style.display = "none";
            element.textContent = "SHOW";
        }
        else {
            AlbumList.style.display = "block";
            element.textContent = "HIDE";
        }
    }
    // Removes or adds all tracks across the library depending on the condition. False means all unselected tracks are added, whereas True means all selected tracks are removed 
    _selectAllTracks(condition) {
        let TrackIDs = [];

        document.querySelectorAll(`fieldset[data-artistcode]`).forEach(artist=> {
            artist.querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(album=> {
                TrackIDs = TrackIDs.concat(this._onSelectAlbum(artist.dataset.artistcode, album.dataset.albumcode, condition, true));
            })
        });

        if (!TrackIDs.length) return;

        if (condition)
            this.services.get("playlist").remove(TrackIDs);
        else
            this.services.get("playlist").add(TrackIDs);
    }

    _onSelectArtist(artistCode, condition) {
        let TrackIDs = [];

        document.querySelector(`fieldset[data-artistcode='${artistCode}']`).querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(album=> {
            TrackIDs = TrackIDs.concat(this._onSelectAlbum(artistCode, album.dataset.albumcode, condition, true));
        });

        if (!TrackIDs.length) return;

        if (condition)
            this.services.get("playlist").remove(TrackIDs);
        else
            this.services.get("playlist").add(TrackIDs);
    }

    _onSelectAlbum(artistCode, albumCode, condition, returnTracksOnly) {

        let AlbumTrackList = document.querySelector(`fieldset[data-albumcode='${albumCode}']`).querySelector(this.selectors.LibraryAlbumTrackListContainer);
        let TrackIDs = [];

        let ChildElements = Array.from(AlbumTrackList.children);
        ChildElements.forEach(element=> {
            if (element.children[0].checked !== condition) return;

            element.children[0].checked = !condition;
            if (element.children[0].dataset.trackid) 
                TrackIDs.push(element.children[0].dataset.trackid);
        });

        if (!TrackIDs.length) return TrackIDs;

        if (condition) {
            this._updateSelectionCounts(artistCode, albumCode, -TrackIDs.length);
            
            if (returnTracksOnly)
                return TrackIDs;

            this.services.get("playlist").remove(TrackIDs);
        }
        else {
            this._updateSelectionCounts(artistCode, albumCode, TrackIDs.length);
            
            if (returnTracksOnly)
                return TrackIDs;

            this.services.get("playlist").add(TrackIDs);
        }
    }

    _onSelectTrack(artistCode, albumCode, trackID, selected) {
        let Playlist = this.services.get("playlist");

        if (selected) {
            if (trackID) Playlist.add([trackID]);
            this._updateSelectionCounts(artistCode, albumCode, 1);
        }
        else {
            if (trackID) Playlist.remove([trackID]);
            this._updateSelectionCounts(artistCode, albumCode, -1);
        }
    }

    _updateSelectionCounts(artistCode, albumCode, newCount) {
        let ArtistSelectedCount = document.querySelector(`fieldset[data-artistcode='${artistCode}']`).querySelector(this.selectors.LibraryArtistSelectedCount);
        let AlbumSelectedCount = document.querySelector(`fieldset[data-albumcode='${albumCode}']`).querySelector(this.selectors.LibraryAlbumSelectedCount);

        ArtistSelectedCount.textContent = parseInt(ArtistSelectedCount.textContent) + newCount;
        AlbumSelectedCount.textContent = parseInt(AlbumSelectedCount.textContent) + newCount;
    }

    _updateAllSelectionCounts() {
        let start = performance.now();

        document.querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(albumContainer=> {
            let selectedTracks = albumContainer.querySelectorAll(`${this.selectors.LibraryAlbumListContainer} input:checked`);
            if (selectedTracks.length > 0)
                this._updateSelectionCounts(selectedTracks[0].dataset.artistcode, albumContainer.dataset.albumcode, selectedTracks.length);
        });

        console.warn(`_updateAllSelectionCounts took ${(performance.now() - start).toFixed(2)} ms`);
    }

    _onTracksAddedToPlaylist(eventData) {
        let playlistIndex = this.elements.UI_Playlist.children.length + 1;

        eventData.added.forEach(trackID=> {
            let playlistEntry = document.createElement("div");
            let trackData = this.services.get("indexes").getTrackData(trackID);

            if (!trackData) {
                this._onError(new Error("_onTracksAddedToPlaylist: No track data for ID: " + trackID || "undefined"));
                return;
            }

            playlistEntry.innerHTML = `<span class="PlaylistEntryCounter">${playlistIndex < 10 ? "0" + playlistIndex : playlistIndex}</span> | ${trackData.TrackArtists.length > 30 ? trackData.TrackArtists.slice(0,30) + "..." : trackData.TrackArtists} - ${trackData.Title.length > 30 ? trackData.Title.slice(0,30) + "..." : trackData.Title} | ${JSUtils.getReadableTime(trackData.Duration)}`;
            playlistEntry.title = trackData.Title;
            playlistEntry.dataset.trackid = trackID;
            playlistEntry.classList.add("PlaylistEntry");

            playlistEntry.addEventListener("click", (event)=> {
                if (event.srcElement.classList.contains("Selected"))
                    event.srcElement.classList.remove("Selected");
                else
                    event.srcElement.classList.add("Selected");
            });

            playlistEntry.addEventListener("dblclick", (event)=> {
                let currentlyPlaying = document.querySelector(this.selectors.PlaylistCurrentlyPlaying);
                if (currentlyPlaying) currentlyPlaying.classList.remove("Playing");

                this.services.get("playlist").setCurrent(event.srcElement.dataset.trackid);
                this.services.get("player").loadNextTrack(event.srcElement.dataset.trackid, true);
                event.srcElement.classList.add("Playing");
            });

            this.elements.UI_Playlist.appendChild(playlistEntry);
            playlistIndex++;
        });
    }

    _onTracksRemovedFromPlaylist(eventData) {
        eventData.removed.forEach(trackID=> {
            let playlistEntry = document.querySelector(`div.PlaylistEntry[data-trackid='${trackID}']`);
            if (playlistEntry) playlistEntry.remove();
        });

        let counter = 1;

        document.querySelectorAll(".PlaylistEntryCounter").forEach(counterElement=> {
            counterElement.textContent = counter < 10 ? "0" + counter : counter;
            counter++;
        });
    }

    _resetPlayerUI() {

        this.elements.UI_PlayCursor.textContent               = "00:00";
        this.elements.UI_Player_Duration.textContent          = "00:00 | 0";
        this.elements.UI_Buffered_Until.textContent           = "00:00";
        this.elements.UI_Buffer_Tail.textContent              = "00:00";
        this.elements.UI_Audio_Buffer.value                   = 0;
        this.elements.UI_Datastream_Progress.max              = 0;
        this.elements.UI_Datastream_Progress.value            = 0;
        this.elements.UI_Datastream_BytesRead.textContent     = "0";
        this.elements.UI_Datastream_BytesExpected.textContent = "0";
        this.elements.UI_AudioObject_State.textContent        = "N/A";
        this.elements.UI_Datastream_State.textContent         = "N/A";
    }

    _resetTrackInfoUI(data={}) {
        if (!data) data = {};

        this.elements.UI_TrackID.textContent        = data.Title || "N/A";
        this.elements.UI_Title.textContent          = data.Album || "N/A";
        this.elements.UI_Album.textContent          = data.AlbumArtists || "N/A";
        this.elements.UI_TrackArtists.textContent   = data.TrackArtists || "N/A";
        this.elements.UI_Year.textContent           = data.Year || "N/A";
        this.elements.UI_Genres.textContent         = data.Genres || "N/A";
        this.elements.UI_Duration.textContent       = data.Duration || "N/A";
        this.elements.UI_Mimetype.textContent       = data.Mimetype || "N/A";
        this.elements.UI_Size.textContent           = data.Size ? data.Size + " bytes" : "0 bytes";
        this.elements.UI_ReplayGain.textContent     = data.ReplayGainTrack || "N/A";
    }

    _searchLibrary() {
        this.elements.UI_LibraryShowHide.checked = true;

        let filter =      (this.elements.UI_LibrarySearchOnAlbum.checked === true ? parseInt(this.elements.UI_LibrarySearchOnAlbum.value)  : 0)
                        | (this.elements.UI_LibrarySearchOnTitle.checked === true ? parseInt(this.elements.UI_LibrarySearchOnTitle.value) : 0)
                        | (this.elements.UI_LibrarySearchOnArtist.checked === true ? parseInt(this.elements.UI_LibrarySearchOnArtist.value) : 0)
                        | (this.elements.UI_LibrarySearchOnGenre.checked === true ? parseInt(this.elements.UI_LibrarySearchOnGenre.value) : 0);

        let searchString = this.elements.UI_LibrarySearchText.value;
        this._createLibraryList( this.services.get("indexes").getCollection(filter, searchString) );
    }

    _createLibraryList(manifest) {
    
        if (!Object.keys(manifest).length) {
            this.elements.UI_LibraryList.innerHTML = "<h1>Nothing found</h1>";
            return;
        }
        
        this.elements.UI_SearchLibrary.disabled = true;
        this.elements.UI_LibraryList.innerHTML = "<h1>Loading...</h1>";

        let output = [];
        let masterTrackIndex = this.services.get("indexes").MasterAudioTrackIndex;
        let playlistEntries = this.services.get("playlist").getAll();

        let start_output = performance.now();

        for (let albumArtistName in manifest) {
            let artistcode = JSUtils.hash(albumArtistName);

            output.push(`<fieldset data-artistcode="${artistcode}" class="ArtistCollection" >
                <legend class="Artist">${albumArtistName} - (<span class="ArtistSelectedCount" >0</span>)</legend>

                <div class="ArtistControls" >
                    <a href="javascript:;" class="ToggleArtist" >HIDE</a>
                    <span>&nbsp;|&nbsp;</span>
                    <a href="javascript:;" data-artistcode="${artistcode}" class="SelectAllInArtist" >ALL</a>
                    <span>&nbsp;|&nbsp;</span>
                    <a href="javascript:;" data-artistcode="${artistcode}" class="DeselectAllInArtist" >NONE</a>
                </div>

                <section class="AlbumList" style="display: block;" >
                    ${Object.keys(manifest[albumArtistName]).map(albumName=> {
                        var albumcode = JSUtils.hash(albumName);

                        return `<fieldset data-albumcode="${albumcode}" class="Album">
                            <legend class="AlbumName">${albumName} - (<span class="AlbumSelectedCount" >0</span>)</legend>

                            <div class="AlbumControls">
                                <a href="javascript:;" class="ToggleAlbum" >HIDE</a>
                                <span>&nbsp;|&nbsp;</span>
                                <a href="javascript:;" data-artistcode="${artistcode}" data-albumcode="${albumcode}" class="SelectAllInAlbum" >ALL</a>
                                <span>&nbsp;|&nbsp;</span>
                                <a href="javascript:;" data-artistcode="${artistcode}" data-albumcode="${albumcode}" class="DeselectAllInAlbum" >NONE</a>
                            </div>

                            <ol class="AlbumTrackList" style="display: block;" >
                                ${manifest[albumArtistName][albumName].map(trackID=> {
                                    let trackData = masterTrackIndex[trackID];

                                    return `<li class="AlbumEntry" >
                                        <input id="${JSUtils.hash(trackID)}" data-albumcode="${albumcode}" data-artistcode="${artistcode}" data-trackid="${trackID}" ${playlistEntries.includes(trackID) ? "checked" : ""} type="checkbox">
                                        <label for="${JSUtils.hash(trackID)}" class="AudioTrack">${trackData.TrackArtists} - ${trackData.Title}</label>
                                    </li>`
                                }).join("")}
                            </ol>
                        </fieldset>`
                    }).join("")}
                </section>
            </fieldset>`);
        }
        
        this.elements.UI_LibraryList.innerHTML = output.join("");
        console.warn(`_createLibraryList: Output took ${(performance.now() - start_output).toFixed(2)} ms`);

        let start_events = performance.now();

        document.querySelectorAll(this.selectors.AlbumListTrack).forEach(
            spanElement=> spanElement.addEventListener("click", (event)=> this._onSelectTrack(
                event.srcElement.dataset.artistcode,
                event.srcElement.dataset.albumcode,
                event.srcElement.dataset.trackid,
                event.srcElement.checked
            ))
        );

        document.querySelectorAll(this.selectors.LibrarySelectAllAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement.dataset.artistcode, event.srcElement.dataset.albumcode, false, false)));
        document.querySelectorAll(this.selectors.LibraryDeSelectAllAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement.dataset.artistcode, event.srcElement.dataset.albumcode, true, false)));
        document.querySelectorAll(this.selectors.LibraryToggleAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onToggleAlbum(event.srcElement)));

        document.querySelectorAll(this.selectors.LibrarySelectAllArtist).forEach(element=> element.addEventListener("click", (event)=> this._onSelectArtist(event.srcElement.dataset.artistcode, false)));
        document.querySelectorAll(this.selectors.LibraryDeSelectAllArtist).forEach(element=> element.addEventListener("click", (event)=> this._onSelectArtist(event.srcElement.dataset.artistcode, true)));
        document.querySelectorAll(this.selectors.LibraryToggleArtist).forEach(element=> element.addEventListener("click", (event)=> this._onToggleArtist(event.srcElement)));

        if (this.elements.UI_LibrarySearchText.value.length >= this.librarySearchTextThreshold)
            this.elements.UI_SearchLibrary.disabled = false;

        console.warn(`_createLibraryList: Attaching event handlers took ${(performance.now() - start_events).toFixed(2)} ms`);
        this._updateAllSelectionCounts();
    }

    _onError(error) {
        if (error instanceof Error) {
            JSUtils.Log(this.elements.InfoLog, error.message, "ERROR");
            console.error(error);
            return;
        }

        let errorOutput;
        if (error === null) {
            errorOutput = "null";
            console.trace();
        }
        else if (error === undefined) {
            errorOutput = "undefined";
            console.trace();
        }
        else
            errorOutput = error.constructor.name;

        JSUtils.Log(this.elements.InfoLog, "Error-param is not an instance of Error: " + errorOutput, "WARNING");
    }

    _onTrackRotated(eventData) {
        JSUtils.Log(this.elements.InfoLog, `MEDIA_CONTROLLER_TRACK_ROTATED (${eventData.trackID})`);

        this._resetPlayerUI();
        this.elements.UI_Datastream_BytesExpected.textContent = JSUtils.getReadableBytes(eventData.trackData.Size);
        this.elements.UI_Datastream_Progress.max = eventData.trackData.Size;
        this._resetTrackInfoUI(eventData.trackData);

        let currentlyPlaying = document.querySelector(this.selectors.PlaylistCurrentlyPlaying);
        if (currentlyPlaying) currentlyPlaying.classList.remove("Playing");
        document.querySelector(`.PlaylistEntry[data-trackid='${eventData.trackID}']`).classList.add("Playing");
    }
}