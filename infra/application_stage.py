import aws_cdk as cdk
from constructs import Construct

from robotic_web_app_infra_stack import RoboticWebAppInfraStack


class RoboticWebAppStage(cdk.Stage):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        env: cdk.Environment,
    ) -> None:
        super().__init__(scope, construct_id, env=env)

        self.application_stack = RoboticWebAppInfraStack(
            self,
            "Application",
            env=env,
            stack_name="RoboticWebAppInfraStack",
        )
