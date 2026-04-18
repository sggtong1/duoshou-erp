# 视频上传流程

- 路径: API文档 / 视频上传API组 / 视频上传流程
- docId: 149198083286
- dirId: 917139576842

---



# 接口调用流程



1、文件上传：  


- 对于20MB以下的视频  


- - 通过接口1获取视频上传的Sign
- 调用文件上传接口2上传文件，获取视频对应vid  




- 对于20MB以上的大视频  


- - 通过接口1获取视频上传的Sign
- 调用大视频文件上传初始化接口3获取分片文件上传Sign
- 通过接口4分片上传文件
- 调用接口5完成分片上传，获取视频对应vid  




2、获取视频转码结果：  


- 通过文件上传返回的vid查询发品所用的视频链接、视频尺寸等信息，视频处理需要时间，上传完成后延迟获取






# 关于视频质量说明  


上传优质主图视频，商品可获得免费流量扶持，预估销量提升2%-30%+

1、使用宽高比1:1或3:4或16:9视频（建议优先采用1:1或3:4视频），大小500M内。最多不超过60s

2、上传视频内容**需含商品主图**，非PPT、无黑边、无水印，且内容及背景音乐需确认无IP侵权

3、上传视频内容建议前10s内突出商品的核心卖点，最好能有语音讲解或配英文字幕 

4、画质清晰，整体不可过暗，不能有较大黑边; 2、播放流畅，画面不可抖动;

5、不可加入外域网址及私人联系方式;图片中避免出现其他品牌及水印;

6、主图视频格式：

![](https://pfs.file.temu.com/supply-service-order-private/supply-basic-open-private/20237f66ca/75766151-6875-42b4-8fd2-c16a2c82a2aa_624x450.png?sign=q-sign-algorithm%3Dsha1%26q-ak%3DOVq7y1S4xnjQFRIFhCmg1QM71Laq80Pr%26q-sign-time%3D1754288198%3B1754289098%26q-key-time%3D1754288198%3B1754289098%26q-header-list%3D%26q-url-param-list%3D%26q-signature%3D856351893e6183380bab5f872ec86433dbf3b2bb)






# 1、查询视频上传sign接口



[bg.goods.video.upload.sign.get](https://agentpartner.temu.com/document?cataId=875198836203&docId=877338943334)

[bg.goods.video.upload.sign.get.global](https://agentpartner.temu.com/document?cataId=875198836203&docId=922385371829)






# 2、20MB以下视频上传




| **接口信息**   | **内容**   |
| 接口编号  | 2  |
| 是否需要授权   | 否，只需传入1中获取的sign即可  |
| 调用地址  | [https://openapi.kuajingmaihuo.com/api/galerie/v1/store_video](https://openapi.kuajingmaihuo.com/api/galerie/v1/store_video) https://openapi-b-partner.temu.com/api/galerie/v1/store_video  |

请求参数：  



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| file  | File  | 是  | 视频文件  |
| create_media  | Boolean  | 是  | 固定值，true  |
| content_md5  | String  | 否  | 文件MD5值，用于校验实际收到的数据和发起方本地的数据是否一致  |
| sign  | String  | 是  | 1中获取的文件上传Sig  |

返回参数：   



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| vid  | String  | 是  | 上传视频文件对应vid，后续查询转码结果使用  |
| error_code  | int  |   | 成功时不返回  |
| error_msg  | String  |   | 错误消息  |




### 


# 3、20MB以上视频上传初始化


| **接口信息**   | **内容**   |
| 接口编号  | 3  |
| 是否需要授权   | 否，只需传入1中获取的sign即可  |
| 调用地址  | [https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_init](https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_init) https://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_init  |

请求参数：  



| **参数名称**    | **类型**    | **是否必须**    | **说明**    |
| create_media  | Boolean  | 是  | 固定值，true  |
| content_type  | String  | 是  | 文件对应的contentType,且必须为视频类型，eg：video/quicktime、video/mp4等  |
| sign  | String  | 是  | 1中获取的文件上传Sign  |

返回参数：   



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| sign  | String  | 是  | 标记本次大文件上传的id  |


### 


# 4、20MB以上视频分片上传




| **接口信息**   | **内容**   |
| 接口编号  | 4  |
| 是否需要授权   | 否，只需传入3中获取的sign即可  |
| 调用地址  | [https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_part](https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_part) https://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_part  |

请求参数：  



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| part_file  | File  | 是  | 视频分片文件  |
| content_md5  | String  | 否  | 文件MD5值，用于校验实际收到的数据和发起方本地的数据是否一致  |
| sign  | String  | 是  | 3中获取的文件上传Sign  |
| part_num  | String  | 是  | 当前分片编号名，从1开始  |

返回参数：   



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| uploaded_part_num  | int  | 是    | 表示本次成功上传的part number  |
| error_code  | int  |   | 成功时不返回  |
| error_msg  | String  |   | 错误消息  |


# 5、20MB以上视频分片上传完成接口


### 


| **接口信息**   | **内容**   |
| 接口编号  | 5  |
| 是否需要授权   | 否，只需传入3中获取的sign即可  |
| 调用地址  | [https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_complete](https://openapi.kuajingmaihuo.com/api/galerie/large_file/v1/video/upload_complete) https://openapi-b-partner.temu.com/api/galerie/large_file/v1/video/upload_complete  |

请求参数：  



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| content_md5  | String  | 否  | 当前大文件的md5，用于违规资源拦截检测  |
| sign  | String  | 是  | 3中获取的文件上传Sign  |

返回参数：   



| **参数名称**  | **类型**  | **是否必须**  | **说明**  |
| vid  | String  | 是  | 上传视频文件对应vid，后续查询转码结果使用  |


# 6、查询视频转码结果接口



[bg.goods.big.video.upload.result.get](https://agentpartner.temu.com/document?cataId=875198836203&docId=877339457222)

[bg.goods.big.video.upload.result.get.global](https://agentpartner.temu.com/document?cataId=875198836203&docId=922387061211)

