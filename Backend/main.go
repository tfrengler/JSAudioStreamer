package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Global vars
var GlobalCmdVars map[string]string
var ServerManifest map[string]ManifestEntry
var MusicRoot string
var BackendIndexFile = "BackendIndex.json"

// Type declarations
type ManifestEntry struct {
	RelativePath string
	FileName     string
}

type ResponseData struct {
	Data  interface{}
	Error bool
	Type  string
}

// Functions

func main() {
	ParseCmdLineArguments()
	ReadAndParseManifest()

	http.HandleFunc("/tracks/getAsBinary", Tracks_GetAsBinary)
	http.HandleFunc("/tracks/getIndex", Tracks_GetIndex)

	fmt.Println("Listener accepting connections on port " + GlobalCmdVars["Port"])
	log.Fatal(http.ListenAndServe(":"+GlobalCmdVars["Port"], nil))
}

func ReadAndParseManifest() {
	Contents, Error := os.ReadFile(BackendIndexFile)
	if Error != nil {
		log.Fatal(Error)
	}

	ServerManifest = make(map[string]ManifestEntry)
	Error = json.Unmarshal(Contents, &ServerManifest)

	if Error != nil {
		log.Fatal(Error)
	}

	fmt.Printf("Backend index read in, holding %d keys\n", len(ServerManifest))
}

func Tracks_GetIndex(response http.ResponseWriter, request *http.Request) {
	var TimeStamp string = time.Now().Format("2006-01-02 15:04:05")
	fmt.Printf("[%s]: /tracks/getIndex | %s | %s | %s\n", TimeStamp, request.RemoteAddr, request.Method, request.URL.Query())

	var AllowedMethods string = "GET,HEAD,OPTIONS"

	if !ValidateFormAndURLScope(&response, request) {
		return
	}

	if !ValidRequestMethod(AllowedMethods, &request.Method) {
		onWrongMethod(&response)
		return
	}

	if !ValidateAuthentication(&response, request) {
		return
	}

	setCORSHeaders(&response, AllowedMethods)
	http.ServeFile(response, request, BackendIndexFile)
}

func Tracks_GetAsBinary(response http.ResponseWriter, request *http.Request) {
	var TimeStamp string = time.Now().Format("2006-01-02 15:04:05")
	fmt.Printf("[%s]: /tracks/getAsBinary | %s | %s | %s\n", TimeStamp, request.RemoteAddr, request.Method, request.URL.Query())

	var AllowedMethods = "GET,HEAD,OPTIONS"

	if !ValidateFormAndURLScope(&response, request) {
		return
	}

	if !ValidRequestMethod(AllowedMethods, &request.Method) {
		onWrongMethod(&response)
		return
	}

	if !ValidateAuthentication(&response, request) {
		return
	}

	var RequestedTrack string = request.Form.Get("TrackID")

	if RequestedTrack == "" {
		response.Header().Set("Content-Type", "text/plain")
		response.WriteHeader(404)
		response.Write([]byte("Missing query param or query param empty: TrackID"))
		return
	}

	TrackData, Found := ServerManifest[RequestedTrack]
	if !Found {
		response.Header().Set("Content-Type", "text/plain")
		response.WriteHeader(404)
		response.Write([]byte("Track with this ID does not exist in the index: " + RequestedTrack))
		return
	}

	var NormalizedRelativePath string = strings.ReplaceAll(TrackData.RelativePath, "\\", "/")
	var TrackAbsolutePathAndName string = GlobalCmdVars["MusicRoot"] + NormalizedRelativePath + "/" + TrackData.FileName

	if _, Error := os.Stat(TrackAbsolutePathAndName); os.IsNotExist(Error) {
		response.Header().Set("Content-Type", "text/plain")
		response.WriteHeader(404)
		response.Write([]byte("Track with this ID does not exist on disk: " + RequestedTrack))
		return
	}

	setCORSHeaders(&response, AllowedMethods)
	http.ServeFile(response, request, TrackAbsolutePathAndName)
}

func onWrongMethod(response *http.ResponseWriter) {

	(*response).Header().Set("Content-Type", "text/plain")
	(*response).WriteHeader(405)
	(*response).Write(nil)

}

func setCORSHeaders(response *http.ResponseWriter, allowedMethods string) {

	(*response).Header().Set("Access-Control-Allow-Credentials", "true")
	(*response).Header().Set("Access-Control-Allow-Headers", "range")
	(*response).Header().Set("Accept-Ranges", "bytes")
	(*response).Header().Set("Access-Control-Allow-Methods", allowedMethods)
	(*response).Header().Set("Access-Control-Allow-Origin", "*")
	(*response).Header().Set("Access-Control-Expose-Headers", "Content-Range")
	(*response).Header().Set("Access-Control-Max-Age", "86400")

}

func ValidateFormAndURLScope(response *http.ResponseWriter, request *http.Request) bool {
	var ParseError error = request.ParseForm()

	if ParseError != nil {

		(*response).Header().Set("Content-Type", "text/plain")
		(*response).WriteHeader(400)
		(*response).Write([]byte(ParseError.Error()))

		return false
	}

	return true
}

func ValidateAuthentication(response *http.ResponseWriter, request *http.Request) bool {
	ActualAuthToken, TokenFound := request.Form["AuthToken"]

	if !TokenFound || (TokenFound && ActualAuthToken[0] != GlobalCmdVars["ValidAuthToken"]) {

		(*response).Header().Set("Content-Type", "text/plain")
		(*response).WriteHeader(401)
		(*response).Write([]byte("No access"))

		return false
	}

	return true
}

func ParseCmdLineArguments() {

	var Port *uint = flag.Uint("Port", 0, "The port the http listener will listen on")
	var MusicRoot *string = flag.String("MusicRoot", "", "The base directory for the music files")
	var AuthToken *string = flag.String("AuthToken", "bff256b4-6d33-47c1-b3ff-39522f01458c", "The auth-token required for each request")

	flag.Parse()

	if *Port == 0 {
		log.Fatal("Cmd line argument 'Port' is required and should be greater than 0")
	}

	if *MusicRoot == "" {
		log.Fatal("Cmd line argument 'MusicRoot' is required")
	}

	if _, Error := os.Stat(*MusicRoot); os.IsNotExist(Error) {
		log.Fatal("Cmd line argument 'MusicRoot' is not a valid directory")
	}

	GlobalCmdVars = make(map[string]string, 2)

	if (*MusicRoot)[len(*MusicRoot)-1] != '/' {
		GlobalCmdVars["MusicRoot"] = *MusicRoot + "/"
	} else {
		GlobalCmdVars["MusicRoot"] = *MusicRoot
	}

	GlobalCmdVars["Port"] = fmt.Sprintf("%d", *Port)
	GlobalCmdVars["ValidAuthToken"] = *AuthToken
}

func ValidRequestMethod(allowedMethods string, method *string) bool {

	var AllowedMethods = strings.Split(allowedMethods, ",")
	return IndexOfString(&AllowedMethods, *method) > -1
}

func IndexOfInt(array *[]int, value int) int {
	for Index, Value := range *array {
		if Value == value {
			return Index
		}
	}

	return -1
}

func IndexOfString(array *[]string, value string) int {
	for Index, Value := range *array {
		if Value == value {
			return Index
		}
	}

	return -1
}
