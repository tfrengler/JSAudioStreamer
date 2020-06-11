export class IndexManager {

    constructor() {
        this.MasterAudioTrackIndex = null;
        
        this.Indexes = Object.freeze({
            TRACKS_BY_ALBUM: {},
            TRACKS_BY_ALBUM_ARTIST: {},
            TRACK_BY_TRACK_ARTIST: {},
            TRACKS_BY_GENRE: {},
            ALBUMS_PER_ALBUM_ARTIST: {}
        });

        this.BackendIndex = null;

        return Object.freeze(this);
    }

    getTrackData(trackID) {
        return this.MasterAudioTrackIndex[trackID || "-1"] || -1;
    }

    getBackendData(trackID) {
        return this.BackendIndex[trackID || "-1"] || -1;
    }

    getTracksByAlbum() {

    }

    getTracksByAlbumArtist() {
        
    }

    getTracksByTrackArtist() {
        
    }

    getTracksGenre() {
        
    }

    getAlbumsPerAlbumArtist() {
        
    }
}