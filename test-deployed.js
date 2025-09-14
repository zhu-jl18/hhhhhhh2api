// Test deployed API with provided key
const apiKey = "eyJydCI6ImVYZjdldlF5STJtSGJ3NUxtT3FOQ2VVcTMiLCJ1c2VyX2lkIjoidXNlcl8wMUs1MldHMjNXVEs5MDVHUzAwV1FONzg4UCIsImVtYWlsIjoiaGVsbG93b3JsZEB5dTA0MTAucXp6LmlvIiwiY2xpZW50X3V1aWQiOiIwMDhiYjMwMS04ODFiLTQzNmQtODliMC1mNDVlODA4YzE3NjEifQ==";
const baseUrl = "https://hhhhhhh2api.vercel.app";

console.log("🚀 Testing deployed API at:", baseUrl);
console.log("🔑 Using provided API key");

async function testDeployedAPI() {
  console.log("\n1️⃣ Testing homepage redirect...");
  try {
    const homeResponse = await fetch(baseUrl);
    console.log(`✅ Homepage: ${homeResponse.status} ${homeResponse.statusText}`);
    if (homeResponse.url !== baseUrl + "/") {
      console.log(`📍 Redirected to: ${homeResponse.url}`);
    }
  } catch (error) {
    console.log(`❌ Homepage error: ${error.message}`);
  }

  console.log("\n2️⃣ Testing /v1/models endpoint...");
  try {
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Models response: ${modelsResponse.status} ${modelsResponse.statusText}`);
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      console.log(`✅ Found ${modelsData.data?.length || 0} models`);
      if (modelsData.data?.length > 0) {
        console.log("📋 Sample models:");
        modelsData.data.slice(0, 3).forEach(model => {
          console.log(`   - ${model.id} (${model.owned_by})`);
        });
      }
    } else {
      const errorData = await modelsResponse.text();
      console.log(`❌ Error response: ${errorData}`);
    }
  } catch (error) {
    console.log(`❌ Models endpoint error: ${error.message}`);
  }

  console.log("\n3️⃣ Testing /v1/chat/completions endpoint...");
  try {
    const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: "Hello! This is a test message. Please respond briefly."
          }
        ],
        stream: false
      })
    });
    
    console.log(`💬 Chat response: ${chatResponse.status} ${chatResponse.statusText}`);
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log(`✅ Chat completed successfully`);
      if (chatData.choices?.[0]?.message?.content) {
        console.log(`📝 Response: ${chatData.choices[0].message.content.substring(0, 100)}...`);
      }
    } else {
      const errorData = await chatResponse.text();
      console.log(`❌ Chat error: ${errorData}`);
    }
  } catch (error) {
    console.log(`❌ Chat endpoint error: ${error.message}`);
  }

  console.log("\n4️⃣ Testing login endpoint...");
  try {
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: "test_code_12345"
      })
    });
    
    console.log(`🔐 Login response: ${loginResponse.status} ${loginResponse.statusText}`);
    // This should fail with invalid code, but confirms the endpoint is accessible
    
  } catch (error) {
    console.log(`❌ Login endpoint error: ${error.message}`);
  }

  console.log("\n🎯 Test completed!");
}

// Add error handling for fetch if not available
if (typeof fetch === 'undefined') {
  console.log("❌ fetch is not available. Please run this in a browser or with Node.js 18+");
} else {
  testDeployedAPI();
}