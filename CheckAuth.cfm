<cffunction name="NotAuthorized" returntype="void" access="public" >
	<cfargument name="reason" type="numeric" required="true" />

	<cfcontent reset="true" />

	<cfoutput>
	<!DOCTYPE html>
	<html>

		<head>
			<title>ACCESS FORBIDDEN</title>
			<meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
			<meta name="author" content="Thomas Frengler" />
		</head>

		<body>
			<section style="color: white; background-color: red" >Not authorized (#arguments.reason#)</section>
		</body>
	</html>
	</cfoutput>

	<cfheader statuscode="401" statustext="Unauthorized" />
	<cfheader name="WWW-Authenticate" value="basic realm='JSAudioStreamer'" />
</cffunction>

<cfset HttpHeaders = getHTTPRequestData().headers />

<cfif structKeyExists(HttpHeaders, "Authorization") IS false >
	<cfset NotAuthorized(reason=1) />
	<cfabort/>
</cfif>

<cfset EncodedUsernameAndPass = listLast(HttpHeaders.authorization, " ") />

<cfif len(EncodedUsernameAndPass) IS 0 >
	<cfset NotAuthorized(reason=2) />
	<cfabort/>
</cfif>

<cfset AuthString = binaryDecode(EncodedUsernameAndPass, "base64") />
<cfset Username = listFirst(AuthString, ":") />
<cfset Password = listLast(AuthString, ":") />

<cfif hash(Username, "SHA-256") NEQ "459C1C33AB6912927E13D5730815EABF7CBE663235D20A6178C9FF105FA63D2D" >
	<cfset NotAuthorized(reason=3) />
	<cfabort/>
</cfif>

<cfif hash(Password, "SHA-256") NEQ "5ED35EAC18634DD7BFCC3DE40619CB227AF4BA7EDFE88E83F23ADFC3E5601CA6" >
	<cfset NotAuthorized(reason=4) />
	<cfabort/>
</cfif>