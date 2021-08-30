# Updates DNS validations using the name.com API
param (
    [Parameter(Mandatory = $true)][string]$username,
    [Parameter(Mandatory = $true)][string]$token
)

# Get certificates that are pending validation
$cert_arn = aws acm list-certificates --region us-east-1 --certificate-statuses PENDING_VALIDATION
    | jq '.CertificateSummaryList[] | select(.DomainName == \"timsam.live\") | .CertificateArn'
if ([string]::IsNullOrEmpty($cert_arn)) {
    Write-Output "No certificates are pending validation."
    exit
}

# Get the validation content
$res = aws acm describe-certificate --certificate-arn $cert_arn --region us-east-1
$dns_key = Write-Output (($res | jq ".Certificate.DomainValidationOptions[0].ResourceRecord.Name") -replace ".timsam.live.")
$dns_val = Write-Output $res | jq ".Certificate.DomainValidationOptions[0].ResourceRecord.Value"

# Update name.com records
$auth_string = $username + ":" + $token
$curl_args = '-u', $auth_string,
                "https://api.name.com/v4/domains/timsam.live/records/$dns_id",
                '-X', 'POST',
                '-H', 'Content-Type: application/json',
                # ???? https://stackoverflow.com/a/66837948/13161283
                '--data', ("{`"host`": $dns_key ,`"type`":`"CNAME`",`"answer`": $dns_val ,`"ttl`":300}" -replace '([\\]*)"', '$1$1\"')
curl @curl_args