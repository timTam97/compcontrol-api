import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3Deploy from '@aws-cdk/aws-s3-deployment';
import * as cloudfront from '@aws-cdk/aws-cloudfront';

export default function ReactOnS3(stack: cdk.Stack) {
    // S3
    const bucket = new s3.Bucket(stack, "ReactBucket", {
        publicReadAccess: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        websiteIndexDocument: "index.html"
    });

    // Deployment
    const src = new s3Deploy.BucketDeployment(stack, "ReactBucketDeployment", {
        sources: [s3Deploy.Source.asset("./lib/src/react-static")],
        destinationBucket: bucket
    });

    // Cloudfront
    const cf = new cloudfront.CloudFrontWebDistribution(stack, "StaticBucketDistribution", {
        originConfigs: [
            {
                s3OriginSource: {
                    s3BucketSource: bucket
                },
                behaviors: [{ isDefaultBehavior: true }]
            },
        ]
    });

    return {bucket, src, cf}
}