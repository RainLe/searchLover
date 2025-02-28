Page({
  
    data: {
      imagePath: '', // 存储图片路径
      dialogContent: '', // 存储用户输入的对话内容
      ocrResult: '', // 存储 OCR 识别结果
      result: '' // 存储分析结果
    },
  
    // 选择图片
    chooseImage() {
      const that = this;
      wx.chooseImage({
        count: 1, // 每次只能选择一张图片
        success(res) {
          const tempFilePath = res.tempFilePaths[0];
          that.setData({
            imagePath: tempFilePath // 更新图片路径
          });
          that.uploadImage(tempFilePath); // 上传图片并调用 OCR 识别
        },
        fail(err) {
          wx.showToast({
            title: '图片选择失败',
            icon: 'none'
          });
          console.error('图片选择失败:', err);
        }
      });
    },
  
    // 上传图片并调用 OCR 识别
    uploadImage(filePath) {
      const that = this;
      wx.showLoading({
        title: '识别中...',
      });

      wx.uploadFile({
        url: 'https://api.ocr.space/parse/image',
        filePath: filePath,
        name: 'file',
        header: {
          'apikey': 'your-key'
        },
        formData: {
          language: 'chs', // 示例：传递 filetype 参数
        },
        success(res) {
          wx.hideLoading();
          const data = JSON.parse(res.data);
          if (data.OCRExitCode===1) {
            // 更新 OCR 识别结果，并将其绑定到 dialogContent
            that.setData({
              ocrResult: data.ParsedResults[0].ParsedText,
              dialogContent: data.ParsedResults[0].ParsedText // 将 OCR 结果更新到文本框中
            });
          } else {
            wx.showToast({
              title: '识别失败',
              icon: 'none'
            });
            console.error('OCR 识别失败:', data);
          }
        },
        fail(err) {
          wx.hideLoading();
          wx.showToast({
            title: '请求失败，请重试',
            icon: 'none'
          });
          console.error('OCR 请求失败:', err);
        }
      });
    },

  // 监听输入框内容变化
  onInputDialog(e) {
    this.setData({
      dialogContent: e.detail.value
    });
  },

  // 点击分析按钮
  analyzeDialog() {
    const content = this.data.dialogContent;
    if (!content) {
      // 如果输入框为空，提示用户输入内容
      wx.showToast({
        title: '请输入对话内容',
        icon: 'none'
      });
      return;
    }

    // 调用分析逻辑
    this.analyzeContent(content);
  },

  // 分析对话内容的函数
  analyzeContent(content) {
    const that = this;
    wx.showLoading({
      title: '分析中...',
    });

    // 调用第三方 API 进行文本分析
    wx.request({
      url: 'https://api.deepseek.com/chat/completions', // 第三方 API 地址
      method: 'POST',
      timeout: 600000,
      header: {
        'Authorization': 'Bearer your-key', // 替换为你的 API 密钥
        'Content-Type': 'application/json'
      },
      data: {
          "messages": [
            {
              "content": "你是一个情感专家，精通心理学和感情分析。你的分析确保专业。你的思考方式：\n1.分析对话中的a与b成为情侣的可能性，并打分\n2.给出原因\n3.提供促进感情发展的下一步计划。注意：用普通文本返回",
              "role": "system"
            },
            {
              "content": "请帮分析这段对话："+content,
              "role": "user"
            }
          ],
          "model": "deepseek-chat",
          "frequency_penalty": 0,
          "max_tokens": 2048,
          "presence_penalty": 0,
          "response_format": {
            "type": "text"
          },
          "stop": null,
          "stream": false,
          "stream_options": null,
          "temperature": 1,
          "top_p": 1,
          "tools": null,
          "tool_choice": "none",
          "logprobs": false,
          "top_logprobs": null
      },
      success(res) {
        wx.hideLoading();
          // 如果分析成功，更新结果
          that.setData({
            result: res.data.choices[0].message.content
          });
        
      },
      fail(err) {
        wx.hideLoading();
        wx.showToast({
          title: '请求失败，请重试',
          icon: 'none'
        });
        console.error('API 请求失败:', err);
      }
    });
  }
});
