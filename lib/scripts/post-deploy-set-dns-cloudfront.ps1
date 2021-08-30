# This script updates DNS records to point to the deployed 
# cloudfront distribution using the name.com API.
param (
    [Parameter(Mandatory = $true)][string]$username,
    [Parameter(Mandatory = $true)][string]$token
)

# Get the domain name of the cloudfront distro
$cf_domain = aws cloudfront list-distributions
    | jq '.DistributionList.Items[] | select(.Aliases.Items[0] == \"timsam.live\") | .DomainName'

$auth_string = $username + ":" + $token

# Get the ID of the DNS record we want to update
$curl_args = '-u', $auth_string,
                'https://api.name.com/v4/domains/timsam.live/records'
$dns_id = curl @curl_args
    | jq '.records[] | select(.fqdn == \"timsam.live.\") | .id'

# Perform the update
$curl_args = '-u', $auth_string,
                "https://api.name.com/v4/domains/timsam.live/records/$dns_id",
                '-X', 'PUT',
                '-H', 'Content-Type: application/json',
                # ???? https://stackoverflow.com/a/66837948/13161283
                '--data', ("{`"host`":`"`",`"type`":`"CNAME`",`"answer`": $cf_domain ,`"ttl`":300}" -replace '([\\]*)"', '$1$1\"')
curl @curl_args
    