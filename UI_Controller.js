import { JSUtils } from "./Utils.js";

class UI_Controller {

    constructor(serviceLocator) {
        this.services = serviceLocator || null;

        this.elements = Object.create(null);

        console.log("UI Controller instantiated" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    init() {

        this.elements.UI_Playlist                   = document.getElementById("PlaylistBody"); // div

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

        this.elements.UI_Audio_Buffer_Limit.innerText = JSUtils.getReadableBytes(12582912);

        Object.freeze(this.elements);
        console.log(`UI Controller initialized, with ${Object.keys(this.elements).length} element-handles`);

        this._initEventHandlers();
    }

    _initEventHandlers() {
        let player = this.services.get("player");

        this.elements.UI_Play.addEventListener("click", ()=> player.play());
        this.elements.UI_Pause.addEventListener("click", ()=> player.pause());
        this.elements.UI_Previous.addEventListener("click", ()=> console.warn("UI_Previous fired")); // TODO(thomas): Placeholders
        this.elements.UI_Next.addEventListener("click", ()=> console.warn("UI_Next fired")); // TODO(thomas): Placeholders
        
        this.elements.UI_Mute.addEventListener("click", ()=> {
            player.mute();
            this.elements.UI_Mute.innerHTML = `${player.audioElement.muted ? "<b>UN-MUTE</b>" : "MUTE"}`; // TODO(thomas): Reaching directly for the player is icky...
        });
        
        this.elements.UI_Volume_Slider.addEventListener("change", (event)=> {
            player.setVolume(event.srcElement.value);
            this.elements.UI_Volume.innerText = (event.srcElement.value * 100) + "%";
        });

        player.audioElement.addEventListener("playing", ()=> this.elements.UI_Player_State.innerText = "PLAYING..."); // TODO(thomas): Reaching directly for the player is icky...
        player.audioElement.addEventListener("pause", ()=> this.elements.UI_Player_State.innerText = "PAUSED"); // TODO(thomas): Reaching directly for the player is icky...
        player.audioElement.addEventListener("timeupdate", ()=> this.elements.UI_PlayCursor.innerText = JSUtils.getReadableTime(player.audioElement.currentTime)); // TODO(thomas): Reaching directly for the player is icky...

        let events = this.services.get("events");

        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_PLAYING, this._onEvent, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_PAUSED, this._onEvent, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_MUTED, this._onEvent, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_VOLUME_CHANGE, this._onEvent, this);
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_DURATION_CHANGED, this._onDurationChanged, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ROTATED, function(data){
            this._resetPlayerUI();
            this.elements.UI_Datastream_BytesExpected.innerText = JSUtils.getReadableBytes(data.Size);
            this.elements.UI_Datastream_Progress.max = data.Size;
            this._resetTrackInfoUI(data);
        }, this);

        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ENDED, this._resetTrackInfoUI, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK, this._onEvent, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE, this._onEvent, this);
        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_METADATA_LOADED, this._onEvent, this);
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
        events.manager.subscribe(events.types.ERROR, function(data){this.elements.UI_Error.innerText = data.error_message}, this);
        
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

        // Album lists
        document.querySelectorAll("span[data-trackid]").forEach(
            spanElement=> spanElement.addEventListener("click", (event)=> player.loadNextTrack(event.srcElement.dataset.trackid, true))
        );
        document.querySelectorAll("input[data-trackid]").forEach(
            spanElement=> spanElement.addEventListener("click", (event)=> this._onSelectTrack(event.srcElement.dataset.trackid, event.srcElement.checked))
        );

        document.querySelectorAll("a.SelectAllInAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement, false)));
        document.querySelectorAll("a.DeselectAllInAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.srcElement, true)));

        document.querySelectorAll("a.ToggleAlbum").forEach(element=> element.addEventListener("click", (event)=> this._onToggleAlbum(event.srcElement)));

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
        let AlbumTrackList = element.parentElement.querySelector("ol.AlbumTrackList");
        let TrackIDs = [];

        let ChildElements = Array.from(AlbumTrackList.children);
        ChildElements.forEach(element=> {
            if (element.children[0].checked !== condition) return;

            element.children[0].checked = !condition;
            TrackIDs.push(element.children[0].dataset.trackid);
        });

        if (condition) 
            this.services.get("playlist").remove(TrackIDs);
        else 
            this.services.get("playlist").add(TrackIDs);
    }

    _onSelectTrack(trackID, selected) {
        let playlist = this.services.get("playlist");

        if (selected)
            playlist.add([trackID]);
        else
            playlist.remove([trackID]);
    }

    _onTracksAddedToPlaylist(data) {
        data.added.forEach(trackID=> {
            let playlistEntry = document.createElement("div");
            let trackData = this.services.get("indexes").MasterAudioTrackIndex[trackID];

            playlistEntry.innerText = `${trackData.TrackArtists} - ${trackData.Title.length > 20 ? trackData.Title.slice(0,20) + "..." : trackData.Title} | ${JSUtils.getReadableTime(trackData.Duration)}`;
            playlistEntry.title = trackData.Title;
            playlistEntry.dataset.trackid = trackID;
            playlistEntry.addEventListener("click", (event)=> this.services.get("player").loadNextTrack(event.srcElement.dataset.trackid, true));
            playlistEntry.classList.add("PlaylistEntry");

            this.elements.UI_Playlist.appendChild(playlistEntry);
        });
    }

    _onTracksRemovedFromPlaylist(data) {
        data.removed.forEach(trackID=> {
            let playlistEntry = document.querySelector(`div.PlaylistEntry[data-trackid='${trackID}']`);
            if (playlistEntry) playlistEntry.remove();
        });
    }

    _onDurationChanged(data) {
        this.elements.UI_Player_Duration.innerText = `${JSUtils.getReadableTime(data.duration)} | ${data.duration}`;
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
}

export {UI_Controller};