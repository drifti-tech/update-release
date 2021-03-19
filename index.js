const github = require('@actions/github')
const core = require('@actions/core')

const token = core.getInput('token')
const { owner, repo } = github.context.repo
const octo = github.getOctokit(token)

async function getDraftRelease() {
  const releases = await octo.repos.listReleases({ owner, repo })
  const draft = releases.data.find((r) => r.draft)
  return draft
}

async function publishRelease() {
  const draft = await getDraftRelease()
  if (!draft) {
    console.log('No draft found, aborting')
    return
  }

  const date = new Date()
  const name = [date.getFullYear(), date.getMonth() + 1, date.getDay()].join('-')
  await octo.repos.updateRelease({ release_id: draft.id, owner, repo, draft: false, name })
}

async function updateRelease() {
  const pull_number = github.context.issue.number

  // Fetch information about the pull request
  const pull = await octo.pulls.get({ owner, repo, pull_number })
  const pr = {
    title: pull.data.title,
    body: pull.data.body,
    user: pull.data.user.login,
  }

  // TODO: parse body and look for issue references like `fixes #123`
  const changelog = `* ${pr.title} (#${pull_number}) @${pr.user}`

  // fetch or create a draft release
  const draft = await getDraftRelease()

  if (draft) {
    await octo.repos.updateRelease({
      release_id: draft.id,
      owner,
      repo,
      body: `${draft.body}\n${changelog}`,
    })
  } else {
    await octo.repos.createRelease({
      owner,
      repo,
      draft: true,
      tag_name: github.context.sha,
      name: 'Neste release',
      body: `# Endringer\n${changelog}`,
    })
  }
}

const action = core.getInput('action')
if (action === 'update') {
  updateRelease()
} else {
  publishRelease()
}
