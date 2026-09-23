# serverless-redirect

CloudFormation stack that redirects every request on `OldDomainName` to `NewDomainName`, keeping scheme, path and query string unchanged. `http://` goes to `http://`, `https://` to `https://`. `NewDomainName` decides whether to upgrade to HTTPS. A CloudFront Function builds the response, so no origin is called.

Resources: CloudFront Function, origin request policy that exposes `CloudFront-Forwarded-Proto` to the function, CloudFront distribution, Route 53 A and AAAA alias records, and an ACM certificate unless `AcmCertificateArn` is set.

## TLS Certificate

You can either provide your own certificate ARN and deploy anywhere, or deploy to `us-east-1`, provide a Route53 hosted zone ID, and let this stack manage the cert for you. 

If you manage the cert yourself, it must cover the `OldDomainName`, either directly, or via a wildcard.

## Requirements

- Public Route 53 hosted zone for `OldDomainName` in the same account.
- No A or AAAA record for `OldDomainName` in that zone.
- `OldDomainName` must not be an alternate domain name on another CloudFront distribution.

## Parameters

| Name | Default | Value |
|---|---|---|
| `OldDomainName` | | Hostname to redirect from, for example `old.example.com` |
| `NewDomainName` | | Hostname to redirect to, for example `new.example.com` |
| `HostedZoneId` | | Hosted zone ID of `OldDomainName`, for example `Z111111QQQQQQQ` |
| `RedirectType` | `permanent` | `permanent` returns 308, `temporary` returns 307 |
| `AcmCertificateArn` | empty | See [TLS Certificate](#tls-certificate) |

## Deploy

```sh
aws cloudformation deploy \
  --region us-east-1 \
  --template-file template.yaml \
  --stack-name old-example-com-redirect \
  --parameter-overrides \
    OldDomainName=old.example.com \
    NewDomainName=new.example.com \
    HostedZoneId=Z111111QQQQQQQ \
    RedirectType=permanent
```

The command returns after ACM issues the certificate and CloudFront deploys the distribution.

With your own certificate, add `AcmCertificateArn=arn:aws:acm:us-east-1:111122223333:certificate/...` to `--parameter-overrides` and set `--region` as needed.

To change `RedirectType`, run the same command with the new value.

## Verify

```sh
curl -sI 'https://old.example.com/a/b?x=1&y'
curl -sI 'http://old.example.com/a/b?x=1&y'
```

Expected: status `308` (or `307`) and `location: https://new.example.com/a/b?x=1&y` for the first request, `location: http://new.example.com/a/b?x=1&y` for the second.

## Remove

```sh
aws cloudformation delete-stack --region us-east-1 --stack-name old-example-com-redirect
```

Use the region the stack was deployed in.

## Scope

One hostname per stack. Deploy a second stack for `www.old.example.com`. The hosted zone is not managed by this stack.

## QA

`.github/workflows/qa.yaml` runs on every push. No AWS access.

```sh
pip install cfn-lint==1.57.0 checkov==3.3.19
cfn-lint template.yaml
checkov --file template.yaml --framework cloudformation --compact --quiet
node --test
```

`node --test` runs the function code from `template.yaml` in Node. It does not check CloudFront Functions runtime restrictions.

## Contributions

Non-LLM-slop contributions and issues are most definitely welcome. 

## License

MIT. See [LICENSE](LICENSE).

## One more thing

This package is brought to you by [Tactic Media, a South Australian software development business](https://tacticmedia.com.au). 

We love to help businesses become more efficient by automating tasks that shouldn't have been done by a human in the first place.

Head over to our website to check out what we do, and if you think we can help you give your employees more time to spend on something more creative, [let's talk](https://tacticmedia.com.au/contact.html)
