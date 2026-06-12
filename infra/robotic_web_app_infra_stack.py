import os
from pathlib import Path

from aws_cdk import (
    BundlingOptions,
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
)
from aws_cdk import aws_apigatewayv2 as apigwv2
from aws_cdk import aws_apigatewayv2_authorizers as apigwv2_authorizers
from aws_cdk import aws_apigatewayv2_integrations as apigwv2_integrations
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3deploy
from aws_cdk import aws_secretsmanager as secretsmanager
from constructs import Construct


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIST_DIR = Path(
    os.getenv("ROBOTIC_FRONTEND_DIST_DIR", ROOT_DIR / "frontend" / "dist")
)


def _context_string(scope: Construct, key: str, default: str = "") -> str:
    value = scope.node.try_get_context(key)
    if value is None:
        return default
    return str(value).strip()


def _context_bool(scope: Construct, key: str, default: bool = False) -> bool:
    value = scope.node.try_get_context(key)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _context_list(scope: Construct, key: str) -> list[str]:
    value = scope.node.try_get_context(key)
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


class RoboticWebAppInfraStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        app_name = _context_string(self, "appName", "robotic-web-app")
        environment_name = _context_string(self, "environmentName", "prod")
        resource_prefix = f"{app_name}-{environment_name}"
        api_auth_enabled = _context_bool(self, "apiAuthEnabled", False)

        frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
            versioned=True,
        )

        origin_identity = cloudfront.OriginAccessIdentity(
            self,
            "FrontendOriginAccessIdentity",
            comment=f"{resource_prefix} frontend access",
        )
        frontend_bucket.grant_read(origin_identity)

        spa_rewrite_function = cloudfront.Function(
            self,
            "SpaRewriteFunction",
            code=cloudfront.FunctionCode.from_inline(
                """
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    if (uri.endsWith("/")) {
        request.uri = uri + "index.html";
    } else if (!uri.includes(".")) {
        request.uri = "/index.html";
    }
    return request;
}
"""
            ),
        )

        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_identity(
                    frontend_bucket,
                    origin_access_identity=origin_identity,
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress=True,
                function_associations=[
                    cloudfront.FunctionAssociation(
                        event_type=cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function=spa_rewrite_function,
                    )
                ],
            ),
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
        )

        artifact_bucket = s3.Bucket(
            self,
            "ArtifactBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(7),
                    enabled=True,
                )
            ],
            removal_policy=RemovalPolicy.RETAIN,
            versioned=True,
        )

        frontend_origin = f"https://{distribution.distribution_domain_name}"
        configured_cors_origins = _context_list(self, "allowedOrigins")
        artifact_cors_origins = [*configured_cors_origins]
        if frontend_origin not in artifact_cors_origins:
            artifact_cors_origins.append(frontend_origin)

        artifact_bucket.add_cors_rule(
            allowed_headers=["*"],
            allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT],
            allowed_origins=artifact_cors_origins,
            exposed_headers=["ETag"],
            max_age=3000,
        )

        user_pool = cognito.UserPool(
            self,
            "UserPool",
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_digits=True,
                require_lowercase=True,
                require_symbols=False,
                require_uppercase=True,
            ),
            removal_policy=RemovalPolicy.RETAIN,
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
            ),
            user_pool_name=f"{resource_prefix}-users",
        )

        user_pool_client = user_pool.add_client(
            "WebClient",
            auth_flows=cognito.AuthFlow(user_password=True, user_srp=True),
            generate_secret=False,
            prevent_user_existence_errors=True,
            user_pool_client_name=f"{resource_prefix}-web",
        )

        lambda_vpc = None
        lambda_security_groups: list[ec2.ISecurityGroup] | None = None
        lambda_vpc_subnets: ec2.SubnetSelection | None = None
        vpc_id = _context_string(self, "vpcId")
        if vpc_id:
            lambda_vpc = ec2.Vpc.from_lookup(self, "ExistingVpc", vpc_id=vpc_id)
            security_group_ids = _context_list(self, "lambdaSecurityGroupIds")
            if security_group_ids:
                lambda_security_groups = [
                    ec2.SecurityGroup.from_security_group_id(
                        self,
                        f"ImportedLambdaSecurityGroup{index}",
                        security_group_id,
                    )
                    for index, security_group_id in enumerate(security_group_ids, start=1)
                ]
            else:
                lambda_security_groups = [
                    ec2.SecurityGroup(
                        self,
                        "BackendLambdaSecurityGroup",
                        allow_all_outbound=True,
                        description=f"{resource_prefix} backend Lambda security group",
                        vpc=lambda_vpc,
                    )
                ]
            lambda_vpc_subnets = ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            )

        database_secret_name = _context_string(self, "databaseSecretName")
        database_secret_arn = _context_string(self, "databaseSecretArn")
        database_name = _context_string(self, "databaseName")
        github_token_secret_arn = _context_string(self, "githubTokenSecretArn")
        github_repo_owner = _context_string(self, "githubRepoOwner")
        github_repo_name = _context_string(self, "githubRepoName")
        github_parameter_path_template = _context_string(
            self,
            "githubParameterPathTemplate",
        )
        database_secret = None
        if database_secret_arn:
            database_secret = secretsmanager.Secret.from_secret_complete_arn(
                self,
                "DatabaseSecret",
                database_secret_arn,
            )
        elif database_secret_name:
            database_secret = secretsmanager.Secret.from_secret_name_v2(
                self,
                "DatabaseSecret",
                database_secret_name,
            )
        github_token_secret = None
        if github_token_secret_arn:
            github_token_secret = secretsmanager.Secret.from_secret_complete_arn(
                self,
                "GitHubTokenSecret",
                github_token_secret_arn,
            )

        backend_environment = {
            "AUTO_CREATE_SQLITE_TABLES": "false",
            "CORS_ORIGINS": ",".join(configured_cors_origins),
            "DEBUG": "false",
            "S3_BUCKET": artifact_bucket.bucket_name,
        }
        if database_secret is not None:
            backend_environment["DATABASE_SECRET_ARN"] = database_secret.secret_arn
        if database_name:
            backend_environment["DATABASE_NAME"] = database_name
        if github_token_secret is not None:
            backend_environment["GITHUB_TOKEN_SECRET_ARN"] = (
                github_token_secret.secret_arn
            )
        if github_repo_owner:
            backend_environment["GITHUB_REPO_OWNER"] = github_repo_owner
        if github_repo_name:
            backend_environment["GITHUB_REPO_NAME"] = github_repo_name
        if github_parameter_path_template:
            backend_environment["GITHUB_PARAMETER_PATH_TEMPLATE"] = (
                github_parameter_path_template
            )

        backend_function_name = f"{resource_prefix}-api"
        backend_log_group = logs.LogGroup(
            self,
            "BackendFunctionLogGroup",
            log_group_name=f"/aws/lambda/{backend_function_name}",
            removal_policy=RemovalPolicy.RETAIN,
            retention=logs.RetentionDays.ONE_MONTH,
        )

        backend_function = lambda_.Function(
            self,
            "BackendFunction",
            architecture=lambda_.Architecture.X86_64,
            code=lambda_.Code.from_asset(
                str(BACKEND_DIR),
                bundling=BundlingOptions(
                    image=lambda_.Runtime.PYTHON_3_14.bundling_image,
                    command=[
                        "bash",
                        "-c",
                        "pip install --no-cache-dir --disable-pip-version-check "
                        "-r requirements-lambda.txt -t /asset-output "
                        "&& cp -R app /asset-output/app "
                        "&& cp -R alembic /asset-output/alembic "
                        "&& cp alembic.ini /asset-output/alembic.ini",
                    ],
                ),
                exclude=[
                    ".env",
                    ".venv",
                    "__pycache__",
                    "dev.db",
                    "sql",
                    "storage",
                    "*.log",
                    "tests",
                ],
            ),
            environment=backend_environment,
            function_name=backend_function_name,
            handler="app.lambda_handler.handler",
            log_group=backend_log_group,
            memory_size=1024,
            runtime=lambda_.Runtime.PYTHON_3_14,
            timeout=Duration.seconds(30),
            vpc=lambda_vpc,
            security_groups=lambda_security_groups,
            vpc_subnets=lambda_vpc_subnets,
        )

        artifact_bucket.grant_read_write(backend_function)
        if database_secret is not None:
            database_secret.grant_read(backend_function)
        if github_token_secret is not None:
            github_token_secret.grant_read(backend_function)

        http_api = apigwv2.HttpApi(
            self,
            "HttpApi",
            api_name=f"{resource_prefix}-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_credentials=True,
                allow_headers=["authorization", "content-type"],
                allow_methods=[
                    apigwv2.CorsHttpMethod.DELETE,
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.OPTIONS,
                    apigwv2.CorsHttpMethod.PATCH,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.PUT,
                ],
                allow_origins=configured_cors_origins,
                max_age=Duration.days(1),
            ),
        )
        backend_integration = apigwv2_integrations.HttpLambdaIntegration(
            "BackendIntegration",
            backend_function,
        )
        authorizer = apigwv2_authorizers.HttpJwtAuthorizer(
            "CognitoAuthorizer",
            jwt_audience=[user_pool_client.user_pool_client_id],
            jwt_issuer=(
                f"https://cognito-idp.{self.region}.amazonaws.com/"
                f"{user_pool.user_pool_id}"
            ),
        )

        http_api.add_routes(
            integration=backend_integration,
            methods=[apigwv2.HttpMethod.GET],
            path="/health",
        )
        http_api.add_routes(
            authorizer=authorizer if api_auth_enabled else None,
            integration=backend_integration,
            methods=[apigwv2.HttpMethod.ANY],
            path="/{proxy+}",
        )

        api_origin = origins.HttpOrigin(
            f"{http_api.api_id}.execute-api.{self.region}.{self.url_suffix}",
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        )
        for path_pattern in ("/v1/*", "/health"):
            distribution.add_behavior(
                path_pattern,
                api_origin,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress=True,
                origin_request_policy=(
                    cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            )

        if FRONTEND_DIST_DIR.exists():
            s3deploy.BucketDeployment(
                self,
                "FrontendDeployment",
                destination_bucket=frontend_bucket,
                distribution=distribution,
                distribution_paths=["/*"],
                sources=[s3deploy.Source.asset(str(FRONTEND_DIST_DIR))],
            )

        CfnOutput(self, "ApiAuthEnabled", value=str(api_auth_enabled).lower())
        self.api_url_output = CfnOutput(
            self,
            "ApiUrl",
            value=http_api.api_endpoint,
        )
        CfnOutput(self, "ArtifactBucketName", value=artifact_bucket.bucket_name)
        CfnOutput(self, "CloudFrontDistributionId", value=distribution.distribution_id)
        CfnOutput(self, "FrontendBucketName", value=frontend_bucket.bucket_name)
        self.frontend_url_output = CfnOutput(
            self,
            "FrontendUrl",
            value=frontend_origin,
        )
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id)
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id)
        if database_secret is None:
            CfnOutput(
                self,
                "DatabaseSecretStatus",
                value="Not configured. Pass -c databaseSecretName=... or -c databaseSecretArn=...",
            )
        if lambda_security_groups:
            CfnOutput(
                self,
                "BackendLambdaSecurityGroupIds",
                value=",".join(group.security_group_id for group in lambda_security_groups),
            )
