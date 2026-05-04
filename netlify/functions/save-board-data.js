exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      password,
      members,
      inoutHistory
    } = JSON.parse(event.body || "{}");

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: "비밀번호가 틀렸습니다." }) };
    }

    if (!Array.isArray(members) || !Array.isArray(inoutHistory)) {
      return { statusCode: 400, body: JSON.stringify({ error: "데이터 형식 오류" }) };
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;
    const path = "data/board-data.json";

    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    const currentRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    let sha = null;
    if (currentRes.ok) {
      const current = await currentRes.json();
      sha = current.sha;
    }

    const nextData = {
      members,
      inoutHistory,
      updatedAt: new Date().toISOString()
    };

    const content = Buffer.from(JSON.stringify(nextData, null, 2), "utf8").toString("base64");

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Update board data from admin",
        content,
        sha,
        branch
      })
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: text }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, updatedAt: nextData.updatedAt })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
