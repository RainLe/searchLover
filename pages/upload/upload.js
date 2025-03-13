// upload.js
const towxml = require('../../towxml/index');

Page({
  data: {
    invaidToday:false,
    recognizedText:"",
    ocrResult: "",
    imagePath: '', // 存储图片路径
    analysisText : '',//ai分析出的数据
    endAnalysis : true,//是否已经结束分析
    article: {}//组装给mardown的数据
  },
  
   // 监听输入框内容变化
   onInputDialog(e) {
    this.setData({
      recognizedText: e.detail.value,
      endAnalysis: false
    });
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
      title: '识别中....',
    });
    wx.uploadFile({
      url: 'https://api.ocr.space/parse/image',
      filePath: filePath,
      name: 'file',
      header: {
        'apikey': 'your apikey'
      },
      formData: {
        language: 'chs', // 示例：传递 filetype 参数
      },
      success(res) {
        wx.hideLoading();
        const data = JSON.parse(res.data);
        if (data.OCRExitCode===1) {
          // 更新 OCR 识别结果，并将其绑定到 recognizedText
          that.setData({
            ocrResult: data.ParsedResults[0].ParsedText,
            recognizedText: data.ParsedResults[0].ParsedText // 将 OCR 结果更新到文本框中
          });
        } else {
          wx.showToast({
            title: '识别失败',
            icon: 'none'
          });
          console.error('OCR 识别失败:', data);
        }
<<<<<<< HEAD
      },
      fail(err) {
        wx.hideLoading();
        wx.showToast({
          title: '请求失败，请重试',
          icon: 'none'
        });
        console.error('OCR 请求失败:', err);
      }
=======
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
>>>>>>> b1ceb06f212d407faed601f7c2c87a0dcc04121d
    });
  },

   // 开始分析
   startAnalysis: function() {
    const that = this;
    if (!that.data.recognizedText.trim()) {
      wx.showToast({
        title: '请输入文本内容',
        icon: 'none'
      });
      return;
    }
    this.analyzeContent(that.data.recognizedText)
  },
  analyzeContent(content) {
    const that = this;

    if(that.data.invaidToday){

      that.setData({
            // analysisText : '今日放假',
            endAnalysis : true,
            article: towxml(`### 今日放假，去玩吧 `,'markdown', {})
      })
      return
    };
    wx.showLoading({
      title: '分析中...',
    });
    // 调用第三方 API 进行文本分析
    wx.request({
      url: 'https://api.deepseek.com/chat/completions', // 第三方 API 地址
      method: 'POST',
      timeout: 600000,
      header: {
<<<<<<< HEAD
        'Authorization': 'Bearer your-token', // 替换为你的 API 密钥
=======
        'Authorization': 'Bearer your-key', // 替换为你的 API 密钥
>>>>>>> b1ceb06f212d407faed601f7c2c87a0dcc04121d
        'Content-Type': 'application/json'
      },
      data: {
          "messages": [
            {
              "content": `你是一个情感专家，精通心理学和感情分析。你的分析确保专业,评估两人成为情侣的可能性（0%-100%），并给出具体原因。最后，简要建议下一步的行动方向，你的答案是一个严格的markdown文本,字数在200以内`,
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
          console.log('json_object = json.loads(json_string)=',
          res.data.choices[0].message.content)
          const markdownResult =  res.data.choices[0].message.content.replace('```markdown', '').replace('```', '')
          // 更新解析数据
          that.setData({
            article: towxml(markdownResult,'markdown', {}),
            analysisText : res.data.choices[0].message.content,
            endAnalysis : true,
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
<<<<<<< HEAD
  },
})
=======
  }
});
>>>>>>> b1ceb06f212d407faed601f7c2c87a0dcc04121d
