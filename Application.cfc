<cfcomponent output="false">

	<cfset this.name="JSAudioStreamer" />
	<cfset this.applicationtimeout = createTimeSpan(1,0,0,0) />
	<cfset this.sessiontimeout = createTimespan(0, 1, 0, 0) />
	<cfset this.sessionmanagement = false />
	<cfset this.setClientCookies = false />

	<cffunction name="onApplicationStart" returnType="boolean" output="false" >

		<cfset this.root = getDirectoryFromPath( getCurrentTemplatePath() ) />
		<!--- <cfset application.musicRoot = this.root & "/Data/Music/" /> --->
		<cfset application.musicRoot = "D:/Music/" />
		<cfset application.m4aRoot = "#this.root#/Data/Music/" />
		<cfset var backendIndex = fileRead("#this.root#/Data/BackendIndex.json") />
		<cfset application.backendIndex = deserializeJSON(backendIndex) />

		<cfreturn true />
	</cffunction>

	<cffunction name="onRequestStart" returntype="boolean" output="false" >
		<cfheader name="X-Accel-Buffering" value="no" />

		<!--- For force refreshing static content programmatically, rather than using Shift + F5 or similar means --->
		<cfif structKeyExists(URL, "Refresh") >
			<cfheader name="Cache-Control" value="no-cache, no-store, must-revalidate" />
			<cfheader name="Pragma" value="no-cache" />
			<cfheader name="Expires" value="0" />
		</cfif>

		<!--- For testing purposes, this nukes the session and restarts the application --->
		<cfif structKeyExists(URL, "Restart") >
			<!--- <cfset sessionInvalidate() /> --->
			<cfset onApplicationStart() />
			<cflocation url=#CGI.SCRIPT_NAME# addtoken=false />
		</cfif>

		<cfreturn true />
	</cffunction>

</cfcomponent>