# 历史模拟祈福数据

这份文件用于给 agent 读取后，直接替换本地历史模拟祈福数据。

用途说明：
- 这批数据不是通用默认待办。
- 这批数据代表“用户此前多次摇卦后留下来的历史祈福事项”。
- 每条都必须对应一个真实问题场景，不能写成泛泛的日常建议。
- 当前代码使用位置：`/Users/shawn/open-calendar/src/home/todo-calendar.tsx` 里的 `INITIAL_TODOS`

字段说明：
- `id`: 本地展示主键
- `date`: 祈福日期，格式 `YYYY-MM-DD`
- `time`: 可选，格式 `HH:mm`
- `item`: 祈福事项，不超过 8 个字
- `reason`: 原因解读，不超过 35 个字
- `tag`: `love` / `wealth` / `study` / `career`
- `question`: 这条祈福事项对应的历史摇卦提问
- `hexagramName`: 对应卦名，用于模拟历史来源
- `completed`: 是否已完成

导入 JSON：

```json
[
  { "id": "1", "date": "2026-04-01", "time": "07:00", "item": "定一志愿", "reason": "目标不钉住，后面复习很容易越学越散", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": false },
  { "id": "3", "date": "2026-04-01", "time": "13:00", "item": "补数学错题", "reason": "反复失分不止住，冲刺期会越学越慌", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": true },
  { "id": "5", "date": "2026-04-03", "time": "09:00", "item": "改简历首屏", "reason": "第一眼没打中重点，机会容易直接滑走", "tag": "career", "question": "今年跳槽能成吗？", "hexagramName": "晋", "completed": true },
  { "id": "6", "date": "2026-04-03", "time": "14:00", "item": "谈清薪资线", "reason": "这次卡点不在机会，在你敢不敢谈底线", "tag": "wealth", "question": "今年跳槽能成吗？", "hexagramName": "晋", "completed": false },
  { "id": "7", "date": "2026-04-05", "time": "20:00", "item": "先停追问", "reason": "你越急着求答案，对方越容易往后退", "tag": "love", "question": "还能和前任复合吗？", "hexagramName": "复", "completed": false },
  { "id": "8", "date": "2026-04-05", "item": "发次近况", "reason": "这次宜轻轻递话，不宜把情绪一下倒满", "tag": "love", "question": "还能和前任复合吗？", "hexagramName": "复", "completed": false },
  { "id": "9", "date": "2026-04-09", "time": "10:00", "item": "先看回撤", "reason": "现在先看能亏多少，不是先想能赚多少", "tag": "wealth", "question": "这笔投资能做吗？", "hexagramName": "节", "completed": false },
  { "id": "10", "date": "2026-04-11", "time": "14:00", "item": "先通口径", "reason": "两边期待不对齐，见面越早越容易别扭", "tag": "love", "question": "这段关系要不要见家长？", "hexagramName": "家人", "completed": false },
  { "id": "11", "date": "2026-04-11", "item": "定见面界线", "reason": "先说好聊到哪，不然现场容易失分", "tag": "love", "question": "这段关系要不要见家长？", "hexagramName": "家人", "completed": false },
  { "id": "12", "date": "2026-04-11", "time": "15:00", "item": "复盘错题", "reason": "临时抱佛脚没用，先找最常错的点", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": false },
  { "id": "13", "date": "2026-04-14", "time": "11:00", "item": "先做体检", "reason": "这件事先看身体底子，别只靠心急往前冲", "tag": "love", "question": "今年要不要备孕？", "hexagramName": "家人", "completed": false },
  { "id": "14", "date": "2026-04-18", "time": "10:00", "item": "重排作息", "reason": "后劲比猛冲更要紧，先把高效时段固定住", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": false },
  { "id": "15", "date": "2026-04-18", "time": "18:30", "item": "约短见面", "reason": "关系要不要续，见一面比隔空猜更准", "tag": "love", "question": "还能和前任复合吗？", "hexagramName": "复", "completed": false },
  { "id": "2", "date": "2026-04-22", "item": "别急定性", "reason": "现在还在试探期，太快下结论容易看偏", "tag": "love", "question": "相亲对象值得继续吗？", "hexagramName": "咸", "completed": false },
  { "id": "4", "date": "2026-04-22", "time": "18:00", "item": "约家里聊聊", "reason": "先听家里真实顾虑，别临见面再补漏洞", "tag": "love", "question": "这段关系要不要见家长？", "hexagramName": "家人", "completed": false },
  { "id": "16", "date": "2026-04-22", "time": "10:00", "item": "学一小节", "reason": "别想着全补完，先吃透最卡的一个点", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": false },
  { "id": "17", "date": "2026-04-26", "time": "09:30", "item": "先算保本线", "reason": "眼下最怕热血上头，账一不清后面全乱", "tag": "wealth", "question": "现在适合创业开店吗？", "hexagramName": "鼎", "completed": false },
  { "id": "18", "date": "2026-04-26", "time": "16:00", "item": "谈清分工", "reason": "合伙最怕好话说满，丑话没先摆清", "tag": "career", "question": "现在适合创业开店吗？", "hexagramName": "鼎", "completed": false },
  { "id": "19", "date": "2026-05-04", "time": "10:00", "item": "读真题卷", "reason": "别再乱刷资料，先摸清出题人的脾气", "tag": "study", "question": "年底考研如何？", "hexagramName": "乾", "completed": false },
  { "id": "20", "date": "2026-05-08", "time": "10:00", "item": "写退出线", "reason": "没退路的决定，后面最容易越补越乱", "tag": "wealth", "question": "这笔投资能做吗？", "hexagramName": "节", "completed": false },
  { "id": "21", "date": "2026-05-08", "time": "14:00", "item": "投三家公司", "reason": "这阵子宜稳不宜散，少投但要投得准", "tag": "career", "question": "今年跳槽能成吗？", "hexagramName": "晋", "completed": false },
  { "id": "22", "date": "2026-05-13", "time": "18:00", "item": "准备见面", "reason": "别只在线上聊，见面后的感受才最准", "tag": "love", "question": "相亲对象值得继续吗？", "hexagramName": "咸", "completed": false },
  { "id": "23", "date": "2026-04-09", "time": "15:00", "item": "查资金锁期", "reason": "流动性一锁死，后面想转身就难了", "tag": "wealth", "question": "这笔投资能做吗？", "hexagramName": "节", "completed": false },
  { "id": "24", "date": "2026-04-22", "time": "11:00", "item": "只下小仓", "reason": "这卦不怕试，就怕一把压重把心态压坏", "tag": "wealth", "question": "这笔投资能做吗？", "hexagramName": "节", "completed": false }
]
```
