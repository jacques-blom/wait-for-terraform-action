# Wait for Terraform

A GitHub Action that waits for Terraform to plan and, optionally apply, before continuing with your workflow.

## Why

In many cases you want to make sure your infrastructure has been planned & applied before you run your action.

Some examples include:

-   You've created a new database, and it needs to finish provisioning before running the new version of your app.
-   Your build step depends on a newly-added IAM permission.
-   Your build step depends on the outputs of your Terraform build (if you're [sharing values](https://www.serverless.com/blog/definitive-guide-terraform-serverless/) between TF and Serverless, for example).

## Example usage

```yml
steps:
    - name: Checkout
      uses: actions/checkout@v2

    - name: Wait for Terraform
      uses: jacques-blom/wait-for-terraform-action@main
      with:
          # The name of your Terraform Cloud organization
          organization: ExampleOrg
          # The names of the workspaces you want to wait for
          # (comma separate if you have multiple)
          workspaces: example-workspace
          # A Terraform Cloud team token (instructions below)
          token: ${{secrets.TF_CLOUD_TOKEN}}
          # Whether or not the step should wait for run to be applied
          # (default: false)
          waitForApply: true

    - name: Build App
      run: yarn build
```

## Creating a token

To create a token with the least amount of access necessary for this step, do the following:

1. Head to the Terraform Cloud [dashboard](https://app.terraform.io/app)
1. Go to Settings > Teams
1. Create a new team (call it "Github Actions", for example)
1. Tick the "Manage Workspaces" permission
1. Click "Update team organization access"
1. Click "Create a team token"
1. Add your token to your GitHub repo's secrets
