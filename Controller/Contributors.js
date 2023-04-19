const { Octokit } = require("octokit");
const octokit = new Octokit({
    auth: process.env.GIT_API_TOKEN
})
var repoCache = []
var contributorCache = []
var proccessing = false
const getAllRepos = (pageNo) => {
    return new Promise(resolve => {
        octokit.request(`GET /users/{username}/repos?page=${pageNo}&&per_page=100`, {
            username: process.env.GIT_OWNER_NAME,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }).then((data) => {
            resolve(data)
        }).catch(() => {
            resolve("Failed")
        })
    })
}


async function contributor(req, res) {
    console.log("Start");
    if (proccessing) {
        res.status(500).json({ message: "Data proccessing. Please try 2 min later." })
        return;
    }
    let fatchState = {
        pageNo: 1,
        hasNext: true
    }
    let repos = [];
    if (repoCache.length !== 0) {
        fatchState.hasNext = false
        repos = repoCache;
    } else {
        proccessing = true
    }
    while (fatchState.hasNext) {
        let tmp = await getAllRepos(fatchState.pageNo);
        if (typeof tmp === "string") {
            res.status(500).json({ message: "Data fetching failed" })
            return;
        }
        repos = [...repos, ...tmp.data]
        if (tmp.data.length < 100) {
            fatchState.hasNext = false
        } else {
            fatchState.pageNo = fatchState.pageNo + 1;
        }
    }
    if (repoCache.length === 0) {
        repoCache = repos
        setTimeout(() => {
            repoCache = []
        }, 30 * 1000 * 60)
    }

    // fetch contributors
    if (contributorCache.length === 0) {
        let contributors = []
        for (let i = 0; i < repos.length; i++) {
            try {
                let fatchState = {
                    pageNo: 1,
                    hasNext: true
                }
                while (fatchState.hasNext) {
                    let tmpcont = await octokit.request(`GET /repos/{owner}/{repo}/contributors?page=${fatchState.pageNo}&&per_page=100`, {
                        owner: process.env.GIT_OWNER_NAME,
                        repo: repos[i].name,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    })
                    if (tmpcont.data.length < 100) {
                        fatchState.hasNext = false
                    } else {
                        fatchState.pageNo = fatchState.pageNo + 1;
                    }
                    contributors = [...contributors, ...tmpcont.data]
                }
            } catch (error) {

            }
        }
        // sort
        contributors.sort((a, b) => a.contributions - b.contributions)
        // make unique contributors
        let uniqueArr = [];
        let uniqueContributors = [];
        for (let i = 0; i < contributors.length; i++) {
            if (!uniqueArr.includes(contributors[i].id)) {
                uniqueArr.push(contributors[i].id);
                uniqueContributors.push({ login: contributors[i].login, avatar_url: contributors[i].avatar_url })
            }
        }
        if (contributorCache.length === 0) {
            contributorCache = uniqueContributors
            setTimeout(() => {
                contributorCache = []
            }, 30 * 1000 * 60)
        }
    }


    proccessing = false
    res.json(contributorCache)
    console.log("END");



}
async function contributorRepos(req, res) {
    let fatchState = {
        pageNo: 1,
        hasNext: true,
        fallback: 0
    }
    let repos = []
    while (fatchState.hasNext && fatchState.fallback < 10) {
        try {
            let tmp = await octokit.request(`GET /users/{username}/repos?page=${fatchState.pageNo}&&per_page=100`, {
                username: req.params.login,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            })
            if (tmp.data.length < 100) {
                fatchState.hasNext = false
            } else {
                fatchState.pageNo = fatchState.pageNo + 1;
            }
            repos = [...repos, ...tmp.data]
        } catch (error) {
            fatchState.fallback = fatchState.fallback + 1

        }
    }
    res.json({ repos: repos.map(v => ({ name: v.name, description: v.description })), contributor: repos[0].owner })

}

async function repoDetails(req, res) {
    let fatchState = {
        pageNo: 1,
        hasNext: true,
        fallback: 0
    }
    let contributors = []
    while (fatchState.hasNext && fatchState.fallback < 10) {
        try {
            let tmp = await octokit.request(`GET /repos/{owner}/{repo}/contributors?page=${fatchState.pageNo}&&per_page=100`, {
                owner: req.params.owner_name,
                repo: req.params.rname,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            })

            if (tmp.data.length < 100) {
                fatchState.hasNext = false
            } else {
                fatchState.pageNo = fatchState.pageNo + 1;
            }
            contributors = [...contributors, ...tmp.data]
        } catch (error) {
            fatchState.fallback = fatchState.fallback + 1

        }
    }
    contributors = contributors.map(v => ({
        login: v.login,
        avatar_url: v.avatar_url,
        contributions: v.contributions
    }))
    let repo = null
    try {
        repo = await octokit.request('GET /repos/{owner}/{repo}', {
            owner: req.params.owner_name,
            repo: req.params.rname,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        })

        repo = repo.data
    } catch (error) {
        //  
    }
    res.json({ contributors, repo })

}
module.exports = { contributor, contributorRepos, repoDetails }