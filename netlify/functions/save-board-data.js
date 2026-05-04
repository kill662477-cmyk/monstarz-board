exports.handler = async function (event) {
  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: jsonHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { password, members, inoutHistory, validateOnly } = body;

    if (!process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "ADMIN_PASSWORD 환경변수가 없습니다." })
      };
    }

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "관리자 비밀번호가 틀렸습니다." })
      };
    }

    if (validateOnly === true) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, mode: "validate" })
      };
    }

    if (!Array.isArray(members) || !Array.isArray(inoutHistory)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "members 또는 inoutHistory 형식이 올바르지 않습니다." })
      };
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;
    const filePath = process.env.BOARD_DATA_PATH || "data/board-data.json";

    if (!owner || !repo || !token) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN 환경변수를 확인하세요." })
      };
    }

    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "monstarz-board-netlify-function"
      }
    });

    let sha = undefined;
    if (getRes.ok) {
      const current = await getRes.json();
      sha = current.sha;
    } else if (getRes.status !== 404) {
      const text = await getRes.text();
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: `기존 JSON 조회 실패: ${text}` })
      };
    }

    const nextData = {
      members,
      inoutHistory,
      updatedAt: new Date().toISOString()
    };

    const content = Buffer.from(JSON.stringify(nextData, null, 2), "utf8").toString("base64");

    const putBody = {
      message: "Update board data from Netlify admin",
      content,
      branch
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "monstarz-board-netlify-function"
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: `GitHub 저장 실패: ${text}` })
      };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, path: filePath, updatedAt: nextData.updatedAt })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};
