import { JSUtils } from "./Utils.js";

class UI_Controller {

    constructor(serviceLocator) {

        this.services = serviceLocator || null;
        this.elements = Object.create(null);

        console.log("UI Controller instantiated" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    init() {

        // Library filter controls
        this.elements.UI_LibraryFilterByALL         = document.getElementById("LibraryFilterByALL");
        this.elements.UI_LibraryFilterByARTISTS     = document.getElementById("LibraryFilterByARTISTS");
        this.elements.UI_LibraryFilterByALBUMS      = document.getElementById("LibraryFilterByALBUMS");
        this.elements.UI_LibraryFilterByGENRES      = document.getElementById("LibraryFilterByGENRES");
        
        // Library search controls
        this.elements.UI_LibrarySearchText          = document.getElementById("LibrarySearchText");
        this.elements.UI_SearchLibrary              = document.getElementById("SearchLibrary");
        this.elements.UI_LibrarySearchOnTitle       = document.getElementById("LibrarySearchOnTitle");
        this.elements.UI_LibrarySearchOnArtist      = document.getElementById("LibrarySearchOnArtist");
        this.elements.UI_LibrarySearchOnAlbum       = document.getElementById("LibrarySearchOnAlbum");
        
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
        this.elements.UI_Error                      = document.getElementById("UI_Error"); // td

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

        this.elements.UI_Audio_Buffer_Limit.innerText = JSUtils.getReadableBytes(this.services.get("player").CHROME_SOURCEBUFFER_LIMIT);

        Object.freeze(this.elements);
        this._initEventHandlers();

        console.log(`UI Controller initialized, with ${Object.keys(this.elements).length} element-handles`);
    }

    _initEventHandlers() {
        let player = this.services.get("player");
        let playlist = this.services.get("playlist");

        // Player interaction handlers
        this.elements.UI_Play.addEventListener("click", ()=> player.play());
        this.elements.UI_Pause.addEventListener("click", ()=> player.pause());

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
            this.elements.UI_Volume.innerText = (event.srcElement.value * 100) + "%";
        });

        /* Info read-out handlers */
        player.audioElement.addEventListener("playing", ()=> this.elements.UI_Player_State.innerText = "PLAYING...");
        player.audioElement.addEventListener("pause", ()=> this.elements.UI_Player_State.innerText = "PAUSED");
        player.audioElement.addEventListener("timeupdate", ()=> this.elements.UI_PlayCursor.innerText = JSUtils.getReadableTime(player.audioElement.currentTime));

        let events = this.services.get("events");

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_DURATION_CHANGED, this._onDurationChanged, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ROTATED, function(data){
            this._resetPlayerUI();
            this.elements.UI_Datastream_BytesExpected.innerText = JSUtils.getReadableBytes(data.Size);
            this.elements.UI_Datastream_Progress.max = data.Size;
            this._resetTrackInfoUI(data);
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_WAITING, function(){ this.elements.UI_Player_State.innerText = "WAITING..."}, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_STALLED, function(){ this.elements.UI_Player_State.innerText = "STALLED!"}, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_OPEN, function(){ this.elements.UI_AudioObject_State.innerText = "OPEN" }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_READY, function(){ this.elements.UI_AudioObject_State.innerText = "READY" }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_COMPLETED, function(){ this.elements.UI_AudioObject_State.innerText = "COMPLETED" }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_DISPOSED, function(){ this.elements.UI_AudioObject_State.innerText = "DISPOSED" }, this);
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFERING, function(){ this.elements.UI_AudioObject_State.innerText = "BUFFERING" }, this);
        events.manager.subscribe(events.types.DATA_STREAM_OPEN, function(){this.elements.UI_Datastream_State.innerText = "OPEN"}, this);
        events.manager.subscribe(events.types.DATA_STREAM_CLOSED, function(){this.elements.UI_Datastream_State.innerText = "CLOSED"}, this);
        events.manager.subscribe(events.types.DATA_STREAM_READING, function(){this.elements.UI_Datastream_State.innerText = "READING"}, this);
        events.manager.subscribe(events.types.ERROR, function(data){if (data && data.error_message) this.elements.UI_Error.innerText = data.error_message}, this);
        
        events.manager.subscribe(events.types.AUDIO_OBJECT_BUFFER_UPDATED, function(data){
            this.elements.UI_Buffered_Until.innerText = JSUtils.getReadableTime(data.buffered_until);
            this.elements.UI_Buffer_Tail.innerText = JSUtils.getReadableTime(data.buffered_from);
        }, this);

        events.manager.subscribe(events.types.DATA_STREAM_CHUNK_RECEIVED, function(data){
            this.elements.UI_Datastream_BytesRead.innerText = JSUtils.getReadableBytes(data.bytes_total);
            this.elements.UI_Datastream_Progress.value = data.bytes_total;
            this.elements.UI_Audio_Buffer.value = data.bytes_total;
        }, this);

        // Playlist
        events.manager.subscribe(events.types.PLAYLIST_TRACKS_ADDED, this._onTracksAddedToPlaylist.bind(this));
        events.manager.subscribe(events.types.PLAYLIST_TRACKS_REMOVED, this._onTracksRemovedFromPlaylist.bind(this));

        // Library controls
        this.elements.UI_LibrarySearchText.addEventListener("input", (event)=> {
            if (event.srcElement.value.length > 2 && this.elements.UI_SearchLibrary.disabled)
                this.elements.UI_SearchLibrary.disabled = false;
            else if (event.srcElement.value.length <= 3)
                this.elements.UI_SearchLibrary.disabled = true;
        });

        this.elements.UI_LibraryFilterByALL.addEventListener("click", ()=> console.warn("CLICKED"));
        this.elements.UI_LibraryFilterByARTISTS.addEventListener("click", ()=> console.warn("CLICKED"));
        this.elements.UI_LibraryFilterByALBUMS.addEventListener("click", ()=> console.warn("CLICKED"));
        this.elements.UI_LibraryFilterByGENRES.addEventListener("click", ()=> console.warn("CLICKED"));
        this.elements.UI_SearchLibrary.addEventListener("click", ()=> console.warn("CLICKED"));

        console.log("UI Controller: event handlers attached");
    }

    // UI handlers
    _onToggleAlbum(element) {
        let AlbumContainer = element.parentElement;
        let AlbumList = AlbumContainer.querySelector("ol.AlbumTrackList");

        if (AlbumList.style.display == "block") {
            AlbumList.style.display = "none";
            element.innerText = "SHOW";
        }
        else {
            AlbumList.style.display = "block";
            element.innerText = "HIDE";
        }
    }

    _onSelectAlbum(element, condition) {
        let AlbumSelectedCount = element.parentElement.querySelector("span.AlbumSelectedCount");
        let AlbumTrackList = element.parentElement.querySelector("ol.AlbumTrackList");
        let TrackIDs = [];

        let ChildElements = Array.from(AlbumTrackList.children);
        ChildElements.forEach(element=> {
            if (element.children[0].checked !== condition) return;

            element.children[0].checked = !condition;
            if (element.children[0].dataset.trackid) 
                TrackIDs.push(element.children[0].dataset.trackid);
        });

        if (!TrackIDs.length) return;

        if (condition) {
            this.services.get("playlist").remove(TrackIDs);
            AlbumSelectedCount.innerText = parseInt(AlbumSelectedCount.innerText) - TrackIDs.length;
        }
        else {
            this.services.get("playlist").add(TrackIDs);
            AlbumSelectedCount.innerText = parseInt(AlbumSelectedCount.innerText) + TrackIDs.length;
        }
    }

    _onSelectTrack(element, trackID, selected) {
        if (!trackID) return;

        let AlbumSelectedCount = element.parentElement.parentElement.parentElement.querySelector("span.AlbumSelectedCount");
        let playlist = this.services.get("playlist");

        if (selected) {
            playlist.add([trackID]);
            AlbumSelectedCount.innerText = parseInt(AlbumSelectedCount.innerText) + 1;
        }
        else {
            playlist.remove([trackID]);
            AlbumSelectedCount.innerText = parseInt(AlbumSelectedCount.innerText) - 1;
        }
    }

    _onTracksAddedToPlaylist(eventData) {
        eventData.added.forEach(trackID=> {
            let playlistEntry = document.createElement("div");
            let trackData = this.services.get("indexes").MasterAudioTrackIndex[trackID];

            playlistEntry.innerText = `${trackData.TrackArtists} - ${trackData.Title.length > 20 ? trackData.Title.slice(0,20) + "..." : trackData.Title} | ${JSUtils.getReadableTime(trackData.Duration)}`;
            playlistEntry.title = trackData.Title;
            playlistEntry.dataset.trackid = trackID;
            playlistEntry.classList.add("PlaylistEntry");

            playlistEntry.addEventListener("click", (event)=> {
                this.services.get("playlist").setCurrent(event.srcElement.dataset.trackid);
                this.services.get("player").loadNextTrack(event.srcElement.dataset.trackid, true);
            });

            this.elements.UI_Playlist.appendChild(playlistEntry);
        });
    }

    _onTracksRemovedFromPlaylist(eventData) {
        eventData.removed.forEach(trackID=> {
            let playlistEntry = document.querySelector(`div.PlaylistEntry[data-trackid='${trackID}']`);
            if (playlistEntry) playlistEntry.remove();
        });
    }

    _onDurationChanged(eventData) {
        this.elements.UI_Player_Duration.innerText = `${JSUtils.getReadableTime(eventData.duration)} | ${eventData.duration}`;
    }

    _resetPlayerUI() {

        this.elements.UI_PlayCursor.innerText               = "00:00";
        this.elements.UI_Player_Duration.innerText          = "00:00 | 0";
        this.elements.UI_Buffered_Until.innerText           = "00:00";
        this.elements.UI_Buffer_Tail.innerText              = "00:00";
        this.elements.UI_Audio_Buffer.value                 = 0;
        this.elements.UI_Datastream_Progress.max            = 0;
        this.elements.UI_Datastream_Progress.value          = 0;
        this.elements.UI_Datastream_BytesRead.innerText     = "0";
        this.elements.UI_Datastream_BytesExpected.innerText = "0";
        this.elements.UI_AudioObject_State.innerText        = "N/A";
        this.elements.UI_Datastream_State.innerText         = "N/A";
    }

    _resetTrackInfoUI(data={}) {
        if (!data) data = {};

        this.elements.UI_TrackID.innerText        = data.Title || "N/A";
        this.elements.UI_Title.innerText          = data.Album || "N/A";
        this.elements.UI_Album.innerText          = data.AlbumArtists || "N/A";
        this.elements.UI_TrackArtists.innerText   = data.TrackArtists || "N/A";
        this.elements.UI_Year.innerText           = data.Year || "N/A";
        this.elements.UI_Genres.innerText         = data.Genres || "N/A";
        this.elements.UI_Duration.innerText       = data.Duration ? `${JSUtils.getReadableTime(data.Duration)} | ${data.Duration}` : "N/A";
        this.elements.UI_Mimetype.innerText       = data.Mimetype || "N/A";
        this.elements.UI_Size.innerText           = data.Size ? data.Size + " bytes" : "0 bytes";
        this.elements.UI_ReplayGain.innerText     = data.ReplayGain || "N/A";
    }

    _getLibraryFormValues() {
        return Object.freeze({
            FILTER: this.elements.UI_LibraryControlForm.elements.LibraryFilter.value,
            SEARCH_OPTION: this.elements.UI_LibraryControlForm.elements.LibrarySearchOption.value,
            SEARCH_TEXT: this.elements.UI_LibrarySearchText
        })
    }

    _searchLibrary() {
    }

    _filterLibrary() {
    }

    _createAlbumList() {
        let AudioTrackIndexes = this.services.get("indexes").AudioTrackIndexes;
        let MasterAudioTrackIndex = this.services.get("indexes").MasterAudioTrackIndex;
        let output = [];

        for(let albumName in AudioTrackIndexes.ALBUMS) {
            output.push(`<fieldset class="Album">
                <legend data-albumcode="${JSUtils.hash(albumName)}" >${albumName} - (<span class="AlbumSelectedCount" >0</span>)</legend>

                <a href="javascript:;" class="ToggleAlbum" >HIDE</a>
                <span>&nbsp;|&nbsp;</span>
                <a href="javascript:;" class="SelectAllInAlbum" >ALL</a>
                <span>&nbsp;|&nbsp;</span>
                <a href="javascript:;" class="DeselectAllInAlbum" >NONE</a>

                <ol class="AlbumTrackList" style="display: block;" >

                ${AudioTrackIndexes.ALBUMS[albumName].map(trackID=> {
                    let TrackData = MasterAudioTrackIndex[trackID];

                    // TODO(thomas): Special provision for the tracks without metadata for the moment
                    let Title;

                    if (TrackData.Title.indexOf("\\") > -1) {
                        let splitTitle = TrackData.Title.split("\\");
                        Title = splitTitle[splitTitle.length-1];
                    }
                    else Title = TrackData.Title;

                    return `<li class="AlbumEntry" >
                        <input data-trackid="${trackID}" type="checkbox">
                        <span class="AudioTrack">${TrackData.TrackArtists} - ${Title}</span>
                    </li>`}).join("")}
                
                </ol>
            </fieldset>`);
        }
        
        document.querySelector("#AlbumList").innerHTML = output.join("");

        document.querySelectorAll("input[data-trackid]").forEach(
            spanElement=> spanElement.addEventListener("click", (event)=> this._onSelectTrack(event.srcElement, event.srcElement.dataset.trackid, event.srcElement.checked))
        );

        document.querySelectorAll("a.SelectAllInAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement, false)));
        document.querySelectorAll("a.DeselectAllInAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement, true)));
        document.querySelectorAll("a.ToggleAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onToggleAlbum(event.srcElement)));
    }
}

export {UI_Controller};