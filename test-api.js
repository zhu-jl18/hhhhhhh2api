// Quick API test script
const apiKey = "eyJydCI6ImVYZjdldlF5STJtSGJ3NUxtT3FOQ2VVcTMiLCJ1c2VyX2lkIjoidXNlcl8wMUs1MldHMjNXVEs5MDVHUzAwV1FONzg4UCIsImVtYWlsIjoiaGVsbG93b3JsZEB5dTA0MTAucXp6LmlvIiwiY2xpZW50X3V1aWQiOiIwMDhiYjMwMS04ODFiLTQzNmQtODliMC1mNDVlODA4YzE3NjEifQ==";

console.log("Testing API Key format...");

try {
  // Test API key format
  const decoded = atob(apiKey);
  const userInfo = JSON.parse(decoded);
  console.log("✅ API Key is valid base64 JSON");
  console.log("User info:", {
    email: userInfo.email,
    user_id: userInfo.user_id,
    has_refresh_token: !!userInfo.rt,
    has_client_uuid: !!userInfo.client_uuid
  });
} catch (error) {
  console.log("❌ API Key format error:", error.message);
}

// Test endpoints locally (when running vercel dev)
async function testEndpoints() {
  const baseUrl = "http://localhost:3000";
  
  console.log("\n🔍 Testing API endpoints...");
  
  try {
    // Test models endpoint
    console.log("Testing /v1/models...");
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      console.log(`✅ Models endpoint: ${models.data?.length || 0} models found`);
    } else {
      console.log(`❌ Models endpoint failed: ${modelsResponse.status} ${modelsResponse.statusText}`);
      const errorText = await modelsResponse.text();
      console.log("Error details:", errorText);
    }
    
  } catch (error) {
    console.log("❌ Network error:", error.message);
    console.log("Make sure to run 'npm run dev' first");
  }
}

// Only run endpoint tests if this script is run directly
if (typeof window === 'undefined') {
  testEndpoints();
}