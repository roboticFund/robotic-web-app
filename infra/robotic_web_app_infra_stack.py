from aws_cdk import Stack
from constructs import Construct


class RoboticWebAppInfraStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Add Cognito, API Gateway, Lambda, S3, and RDS resources here.
