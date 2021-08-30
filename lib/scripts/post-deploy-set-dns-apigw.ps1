# This script updates DNS records to point to the deployed 
# cloudfront distribution using the name.com API.
param (
    [Parameter(Mandatory = $true)][string]$username,
    [Parameter(Mandatory = $true)][string]$token
)

# Get the domain name of the cloudfront distro
$http_endpoint = aws apigatewayv2 get-domain-names 
    | jq '.Items[] | select(.DomainName == \"command.timsam.live\") | .DomainNameConfigurations[0].ApiGatewayDomainName'
$websocket_endpoint = aws apigatewayv2 get-domain-names 
    | jq '.Items[] | select(.DomainName == \"wss.timsam.live\") | .DomainNameConfigurations[0].ApiGatewayDomainName'

$auth_string = $username + ":" + $token

# Get the ID for command.timsam.live (HTTP)
$curl_args = '-u', $auth_string,
                'https://api.name.com/v4/domains/timsam.live/records'
$dns_id = curl @curl_args
    | jq '.records[] | select(.fqdn == \"command.timsam.live.\") | .id'
$curl_args = '-u', $auth_string,
                "https://api.name.com/v4/domains/timsam.live/records/$dns_id",
                '-X', 'PUT',
                '-H', 'Content-Type: application/json',
                '--data', ("{`"host`":`"command`",`"type`":`"CNAME`",`"answer`": $http_endpoint ,`"ttl`":300}" -replace '([\\]*)"', '$1$1\"')
curl @curl_args

# Now do the same for the websocket endpoint
$curl_args = '-u', $auth_string,
                'https://api.name.com/v4/domains/timsam.live/records'
$dns_id = curl @curl_args
    | jq '.records[] | select(.fqdn == \"wss.timsam.live.\") | .id'
$curl_args = '-u', $auth_string,
                "https://api.name.com/v4/domains/timsam.live/records/$dns_id",
                '-X', 'PUT',
                '-H', 'Content-Type: application/json',
                '--data', ("{`"host`":`"wss`",`"type`":`"CNAME`",`"answer`": $websocket_endpoint ,`"ttl`":300}" -replace '([\\]*)"', '$1$1\"')
curl @curl_args

    