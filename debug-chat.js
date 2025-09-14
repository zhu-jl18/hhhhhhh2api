// 详细测试聊天端点
const apiKey = "eyJydCI6ImVYZjdldlF5STJtSGJ3NUxtT3FOQ2VVcTMiLCJ1c2VyX2lkIjoidXNlcl8wMUs1MldHMjNXVEs5MDVHUzAwV1FONzg4UCIsImVtYWlsIjoiaGVsbG93b3JsZEB5dTA0MTAucXp6LmlvIiwiY2xpZW50X3V1aWQiOiIwMDhiYjMwMS04ODFiLTQzNmQtODliMC1mNDVlODA4YzE3NjEifQ==";
const baseUrl = "https://hhhhhhh2api.vercel.app";

console.log("🔍 调试聊天端点...");

async function debugChat() {
  // 首先获取可用模型
  console.log("1. 获取可用模型...");
  const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  if (!modelsResponse.ok) {
    console.log("❌ 无法获取模型列表");
    return;
  }
  
  const modelsData = await modelsResponse.json();
  const firstModel = modelsData.data[0];
  console.log(`✅ 使用模型: ${firstModel.id}`);
  
  // 测试聊天请求
  console.log("\n2. 测试聊天请求...");
  const chatPayload = {
    model: firstModel.id,
    messages: [
      {
        role: "user",
        content: "Hello"
      }
    ],
    stream: false
  };
  
  console.log("📤 发送请求:", JSON.stringify(chatPayload, null, 2));
  
  try {
    const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatPayload)
    });
    
    console.log(`📥 响应状态: ${chatResponse.status} ${chatResponse.statusText}`);
    
    const responseText = await chatResponse.text();
    console.log("📥 响应内容:", responseText);
    
    if (chatResponse.ok) {
      console.log("✅ 聊天请求成功！");
    } else {
      console.log("❌ 聊天请求失败");
      
      // 尝试解析错误
      try {
        const errorData = JSON.parse(responseText);
        console.log("错误详情:", errorData);
      } catch {
        console.log("无法解析错误响应为JSON");
      }
    }
  } catch (error) {
    console.log("❌ 网络错误:", error.message);
  }
}

debugChat();