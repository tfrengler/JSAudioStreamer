<cfheader name="access-control-allow-credentials" value="true" />
<cfheader name="access-control-allow-headers" value="range" />  
<cfheader name="accept-ranges" value="bytes" />
<cfheader name="access-control-allow-methods" value="GET, HEAD, OPTIONS" />
<cfheader name="access-control-allow-origin" value="*" />
<cfheader name="access-control-expose-headers" value="Content-Range" />
<cfheader name="access-control-max-age" value="86400" />

<cfparam name="URL.ID" type="string" default="NO_ID_PASSED_IN_URL" />
<cfset mimeType = "application/octet-stream" />

<cfif structKeyExists(application.backendIndex, URL.ID) >
    <cfset backendEntry = application.backendIndex[URL.ID] />
    <cfif application.m4aRoot NEQ null AND listLast(backendEntry.FileName, ".") EQ "m4a" >
        <cfset filePath = "#application.m4aRoot##backendEntry.RelativePath#/#backendEntry.FileName#" />
    <cfelse>
        <cfset filePath = "#application.musicRoot##backendEntry.RelativePath#/#backendEntry.FileName#" />
    </cfif>

<cfelse>
    <cfheader statuscode="400" statustext="ID does not exist in backendindex: #URL.ID#" />
    <cfabort/>
</cfif>

<!--- <cfdump var=#getHTTPRequestData()# />
<cfdump var=#getFileInfo(filePath)# abort="true" /> --->

<!--- <cfif getHTTPRequestData().method NEQ "GET" >
    <cfheader name="Content-Length" value=#getFileInfo(filePath).size# />
</cfif> --->

<cfheader name="Content-Disposition" value="inline" />
<cfcontent file=#filePath# type="application/octet-stream" />