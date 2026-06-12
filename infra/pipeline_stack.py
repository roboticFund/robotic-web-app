import aws_cdk as cdk
from aws_cdk import aws_codebuild as codebuild
from aws_cdk import pipelines
from constructs import Construct

from application_stage import RoboticWebAppStage


def _required_context(scope: Construct, key: str) -> str:
    value = scope.node.try_get_context(key)
    if value is None or not str(value).strip():
        raise ValueError(f"Missing required CDK context value: {key}")
    return str(value).strip()


class RoboticWebAppPipelineStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        connection_arn = _required_context(self, "githubConnectionArn")
        repository = _required_context(self, "githubRepository")
        branch = _required_context(self, "githubBranch")

        source = pipelines.CodePipelineSource.connection(
            repository,
            branch,
            connection_arn=connection_arn,
            trigger_on_push=True,
        )

        synth = pipelines.ShellStep(
            "BuildTestAndSynth",
            input=source,
            install_commands=[
                "python -m pip install --disable-pip-version-check -r infra/requirements.txt",
                "npm install --global aws-cdk@2",
            ],
            commands=[
                "python -m pip install --disable-pip-version-check -r backend/requirements.txt",
                "(cd backend && python -m unittest discover)",
                "(cd frontend && npm ci && npm run build)",
                "(cd infra && cdk synth --app 'python pipeline_app.py')",
            ],
            primary_output_directory="infra/cdk.out",
        )

        pipeline = pipelines.CodePipeline(
            self,
            "Pipeline",
            pipeline_name="robotic-web-app-prod",
            cross_account_keys=False,
            docker_enabled_for_synth=True,
            self_mutation=True,
            synth=synth,
            synth_code_build_defaults=pipelines.CodeBuildOptions(
                build_environment=codebuild.BuildEnvironment(
                    build_image=codebuild.LinuxBuildImage.STANDARD_7_0,
                    compute_type=codebuild.ComputeType.SMALL,
                    privileged=True,
                )
            ),
        )

        production = RoboticWebAppStage(
            self,
            "Production",
            env=cdk.Environment(account=self.account, region=self.region),
        )
        pipeline.add_stage(
            production,
            post=[
                pipelines.ShellStep(
                    "ProductionSmokeTest",
                    commands=[
                        'curl --fail --silent --show-error --retry 6 '
                        '--retry-delay 10 "$FRONTEND_URL/health"',
                        'curl --fail --silent --show-error --retry 6 '
                        '--retry-delay 10 "$FRONTEND_URL/v1/algorithms/?limit=1"',
                    ],
                    env_from_cfn_outputs={
                        "FRONTEND_URL": (
                            production.application_stack.frontend_url_output
                        )
                    },
                )
            ],
        )
