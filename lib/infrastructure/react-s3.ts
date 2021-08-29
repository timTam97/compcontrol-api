import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3Deploy from "@aws-cdk/aws-s3-deployment";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as acm from "@aws-cdk/aws-certificatemanager";

export default function ReactOnS3(stack: cdk.Stack) {
    // Certificate needed for custom domain name on cloudfront
    const cert = new acm.Certificate(stack, "CompControlDomainCert", {
        domainName: "timsam.live",
        validation: acm.CertificateValidation.fromDns(),
    });

    // S3
    const bucket = new s3.Bucket(stack, "ReactBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Let cloudfront see the S3 bucket
    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(
        stack,
        "ReactOAI",
        {
            comment: "OAI for home page",
        }
    );
    bucket.grantRead(cloudfrontOAI);

    // Deploy site to S3
    const src = new s3Deploy.BucketDeployment(stack, "ReactBucketDeployment", {
        sources: [s3Deploy.Source.asset("./lib/src/react-static/build")],
        destinationBucket: bucket,
    });

    // Cloudfront
    const cf = new cloudfront.CloudFrontWebDistribution(
        stack,
        "StaticBucketDistribution",
        {
            originConfigs: [
                {
                    s3OriginSource: {
                        s3BucketSource: bucket,
                        originAccessIdentity: cloudfrontOAI,
                    },
                    behaviors: [{ isDefaultBehavior: true }],
                },
            ],
            viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
                cert,
                {
                    aliases: ["timsam.live"],
                    securityPolicy:
                        cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
                }
            ),
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        }
    );

    return { bucket, src, cf, cloudfrontOAI };
}
