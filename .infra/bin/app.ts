#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StaticSiteStack } from "../lib/static-site-stack";

const app = new cdk.App();

new StaticSiteStack(app, "JustChooseSiteStack", {
  env: {
    // Deploy to us-east-1 so the ACM certificate works with CloudFront
    // (CloudFront requires certificates in us-east-1)
    account: "956301286495",
    region: "us-east-1",
  },
  domainName: "justchoooose.com",
});
