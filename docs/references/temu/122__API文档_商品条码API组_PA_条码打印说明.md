# 条码打印说明

- 路径: API文档 / 商品条码API组-PA / 条码打印说明
- docId: 163884783129
- dirId: 931825798694

---





# 一、参数说明



以下接口可通过传入return_data_key=true直接打印

[bg.glo.goods.custom.label.get](https://agentpartner.temu.com/document?cataId=875198836203&docId=924483272975)

[bg.glo.goods.labelv2.get](https://agentpartner.temu.com/document?cataId=875198836203&docId=925530254496)






| **参数名称 **    | **类型 **    | **是否必须 **    | **说明 **    |
| return_data_key    | boolean    | 否    | 是否以打印页面url返回，如果入参是，则不返回参数信息，返回dataKey，通过拼接[https://openapi-b-partner.temu.com/tool/print?dataKey=](https://openapi-b-partner.temu.com/tool/print?dataKey=xxx){返回的dataKey}，访问组装的url即可打印，打印的条码按照入参参数所得结果进行打印 链接10min内单次有效，请求过立即失效  |


# 二、请求样例


```
  
  
  
  
  
  
  
  
  
  
  

```




# 三、返回样例


```
  
  
  
  
  
  

```






# 四、条码打印样例




```

```

![image.png](https://agentpartner.temu.com/supply-basic-open-private-glo/2019505a068/30a84d01-18e6-46d0-a594-30c680d8975d_1218x462.png)






# 五、链接单次有效，再次访问后失效



![image.png](https://agentpartner.temu.com/supply-basic-open-private-glo/2019505a068/e3f5ff00-65e1-45d8-b093-c2d4b4d70ae6_1798x1044.png)

