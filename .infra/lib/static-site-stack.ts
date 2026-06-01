import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

interface StaticSiteStackProps extends cdk.StackProps {
  /** The root domain name, e.g. "justchoooose.com" */
  domainName: string;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    // ────────────────────────────────────────────
    // Route 53 Hosted Zone (must already exist)
    // ────────────────────────────────────────────
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName,
    });

    // ────────────────────────────────────────────
    // ACM Certificate  (us-east-1 — same region)
    // ────────────────────────────────────────────
    const certificate = new acm.Certificate(this, "SiteCertificate", {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ────────────────────────────────────────────
    // S3 Bucket  (private, accessed only via CloudFront OAC)
    // ────────────────────────────────────────────
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `${domainName}-site`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ────────────────────────────────────────────
    // CloudFront Distribution
    // ────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      domainNames: [domainName, `www.${domainName}`],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // Serve 404.html for missing objects (S3 returns 403 for non-existent
      // keys when public access is blocked, so we handle both 403 and 404).
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: "/404.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: "/404.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // ────────────────────────────────────────────
    // Route 53 DNS Records
    // ────────────────────────────────────────────

    // Apex domain  (justchoooose.com)
    new route53.ARecord(this, "SiteARecord", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });
    new route53.AaaaRecord(this, "SiteAaaaRecord", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });

    // www subdomain  (www.justchoooose.com)
    new route53.ARecord(this, "WwwARecord", {
      zone: hostedZone,
      recordName: "www",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });
    new route53.AaaaRecord(this, "WwwAaaaRecord", {
      zone: hostedZone,
      recordName: "www",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });

    // ────────────────────────────────────────────
    // Deploy site content to S3 + invalidate cache
    // ────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../site"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // ────────────────────────────────────────────
    // Outputs
    // ────────────────────────────────────────────
    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${domainName}`,
      description: "Website URL",
    });
    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      description: "CloudFront Distribution ID",
    });
    new cdk.CfnOutput(this, "BucketName", {
      value: siteBucket.bucketName,
      description: "S3 Bucket Name",
    });
  }
}
