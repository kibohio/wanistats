// Sample subjects written for this project. Glosses are plain dictionary meanings in the style of
// KANJIDIC2; radical names follow the Unicode Kangxi radical names. Readings are in hiragana.

/** `char meaning` */
export const RADICALS = `
一 one
二 two
口 mouth
人 person
大 big
小 small
山 mountain
川 river
卜 divination
丨 line
日 sun
月 moon
木 tree
入 enter
十 ten
力 power
女 woman
子 child
王 king
田 field
目 eye
白 white
手 hand
火 fire
水 water
土 earth
ノ slash
夕 evening
文 script
刀 knife
厂 cliff
工 work
立 stand
生 life
儿 legs
艹 grass
亻 person (side)
匕 spoon
宀 roof
冖 cover
囗 enclosure
亠 lid
八 eight
乙 second
亅 hook
寸 inch
糸 silk
赤 red
青 blue
穴 cave
雨 rain
車 cart
貝 shell
气 steam
丶 dot
止 stop
牛 cow
竹 bamboo
米 rice
虫 insect
耳 ear
金 metal
父 father
母 mother
又 again
冂 down box
方 square
毛 fur
心 heart
戸 door
弓 bow
干 dry
西 west
門 gate
長 long
礻 altar (side)
厶 private
彳 step
自 self
言 speech
士 scholar
舌 tongue
聿 brush
食 food
欠 lack
罒 net
广 dotted cliff
辶 walk
斤 axe
尸 corpse
夂 go
冫 ice
禾 grain
巾 cloth
色 colour
氵 water (side)
勹 wrap
扌 hand (side)
几 table
戈 halberd
疒 sickness
阝 mound
匚 box
矢 arrow
歹 death
里 village
石 stone
馬 horse
攵 rap
隹 short-tailed bird
豆 bean
癶 dotted tent
頁 leaf
鳥 bird
羽 feather
羊 sheep
氏 clan
皿 dish
皮 skin
酉 wine
己 oneself
走 run
`;

/**
 * `char|meanings (/)|onyomi|kunyomi|component radicals`, grouped under `#level`.
 * No components means the kanji is its own radical.
 */
export const KANJI = `
#1
一|one|いち|ひと|
二|two|に|ふた|
三|three|さん|み|一二
口|mouth|こう|くち|
人|person|じん|ひと|
大|big|だい|おお|
小|small|しょう|ちい|
山|mountain|さん|やま|
川|river|せん|かわ|
上|above/up|じょう|うえ|卜一
下|below/down|か|した|一卜
中|middle|ちゅう|なか|口丨
日|sun/day|にち|ひ|
月|moon/month|げつ|つき|
木|tree|もく|き|
入|enter|にゅう|はい|
十|ten|じゅう|とお|
力|power|りょく|ちから|
#2
女|woman|じょ|おんな|
子|child|し|こ|
王|king|おう||
田|rice field|でん|た|
目|eye|もく|め|
白|white|はく|しろ|
手|hand|しゅ|て|
火|fire|か|ひ|
水|water|すい|みず|
土|soil|ど|つち|
千|thousand|せん|ち|ノ十
夕|evening|せき|ゆう|
文|writing|ぶん|ふみ|
天|heaven|てん|あま|一大
本|book/origin|ほん|もと|木一
刀|sword|とう|かたな|
石|stone|せき|いし|厂口
右|right|う|みぎ|ノ一口
#3
左|left|さ|ひだり|ノ一工
工|craft|こう||
出|exit|しゅつ|で|山
立|stand|りつ|た|
生|life|せい|い|
先|ahead/previous|せん|さき|儿土
花|flower|か|はな|艹亻匕
字|character|じ|あざ|宀子
学|study|がく|まな|冖子
休|rest|きゅう|やす|亻木
体|body|たい|からだ|亻木一
名|name|めい|な|夕口
林|woods|りん|はやし|木
森|forest|しん|もり|木
四|four|し|よ|囗儿
五|five|ご|いつ|一丨
六|six|ろく|む|亠八
七|seven|しち|なな|一乙
八|eight|はち|や|
九|nine|きゅう|ここの|ノ乙
#4
百|hundred|ひゃく||一白
男|man|だん|おとこ|田力
町|town|ちょう|まち|田亅
村|village|そん|むら|木寸
糸|thread|し|いと|
赤|red|せき|あか|
青|blue|せい|あお|
空|sky|くう|そら|穴工
雨|rain|う|あめ|
車|car|しゃ|くるま|
音|sound|おん|おと|立日
早|early|そう|はや|日十
年|year|ねん|とし|ノ一十
見|see|けん|み|目儿
貝|shellfish||かい|
気|spirit|き||气
玉|ball|ぎょく|たま|王丶
犬|dog|けん|いぬ|大丶
正|correct|せい|ただ|一止
足|foot|そく|あし|口止
#5
牛|cow|ぎゅう|うし|
竹|bamboo|ちく|たけ|
米|rice|べい|こめ|
虫|insect|ちゅう|むし|
耳|ear|じ|みみ|
金|gold/money|きん|かね|
校|school|こう||木亠父
父|father|ふ|ちち|
母|mother|ぼ|はは|
友|friend|ゆう|とも|一ノ又
古|old|こ|ふる|十口
半|half|はん|なか|八二丨
北|north|ほく|きた|匕
今|now|こん|いま|人一
内|inside|ない|うち|冂人
午|noon|ご||ノ十
方|direction|ほう|かた|
毛|fur|もう|け|
心|heart|しん|こころ|
戸|door|こ|と|
引|pull|いん|ひ|弓丨
弓|bow|きゅう|ゆみ|
#6
西|west|せい|にし|
東|east|とう|ひがし|木日
南|south|なん|みなみ|十冂干
外|outside|がい|そと|夕卜
間|interval|かん|あいだ|門日
門|gate|もん|かど|
聞|hear|ぶん|き|門耳
長|long|ちょう|なが|
高|tall/expensive|こう|たか|亠口冂
会|meet|かい|あ|人二厶
社|company|しゃ|やしろ|礻土
何|what|か|なに|亻口亅
来|come|らい|く|一米
行|go|こう|い|彳
自|self|じ|みずか|
分|part/minute|ぶん|わ|八刀
切|cut|せつ|き|十刀
多|many|た|おお|夕
少|few|しょう|すく|小ノ
#7
言|say|げん|い|
読|read|どく|よ|言士儿
話|talk|わ|はな|言舌
語|language|ご|かた|言口
書|write|しょ|か|聿日
食|eat|しょく|た|
飲|drink|いん|の|食欠
買|buy|ばい|か|罒貝
売|sell|ばい|う|士冖儿
店|shop|てん|みせ|广卜口
道|road|どう|みち|辶自
近|near|きん|ちか|辶斤
遠|far|えん|とお|辶土口
週|week|しゅう||辶冂土口
朝|morning|ちょう|あさ|十日月
昼|noon|ちゅう|ひる|尸日一
夜|night|や|よる|亠亻夕
#8
雪|snow|せつ|ゆき|雨一
電|electricity|でん||雨田乙
春|spring|しゅん|はる|一人日
夏|summer|か|なつ|一自夂
秋|autumn|しゅう|あき|禾火
冬|winter|とう|ふゆ|夂冫
寺|temple|じ|てら|土寸
時|time|じ|とき|日土寸
明|bright|めい|あか|日月
光|light|こう|ひかり|小一儿
太|fat|たい|ふと|大丶
晴|clear up|せい|は|日青
弟|younger brother|てい|おとうと|弓ノ丨
兄|older brother|きょう|あに|口儿
姉|older sister|し|あね|女亠巾
妹|younger sister|まい|いもうと|女木一
色|colour|しょく|いろ|
思|think|し|おも|田心
#9
海|sea|かい|うみ|氵母
池|pond|ち|いけ|氵乙
決|decide|けつ|き|氵大
洗|wash|せん|あら|氵儿土
地|ground|ち||土乙
場|place|じょう|ば|土日
活|lively|かつ||氵舌
作|make|さく|つく|亻ノ一
使|use|し|つか|亻口一
住|dwell|じゅう|す|亻王丶
物|thing|ぶつ|もの|牛勹
始|begin|し|はじ|女厶口
終|end|しゅう|お|糸夂冫
持|hold|じ|も|扌土寸
指|finger|し|ゆび|扌匕日
投|throw|とう|な|扌几又
主|master|しゅ|ぬし|王丶
注|pour|ちゅう|そそ|氵王丶
#10
悪|bad|あく|わる|一口心
急|hurry|きゅう|いそ|勹心
意|idea|い||立日心
感|feeling|かん||戈口心
想|concept|そう||木目心
息|breath|そく|いき|自心
病|illness|びょう|やまい|疒一人
院|institution|いん||阝宀儿
医|doctor|い||匚矢
薬|medicine|やく|くすり|艹白木
死|death|し|し|歹匕
部|section|ぶ||立口阝
都|capital|と|みやこ|土日阝
送|send|そう|おく|辶八一大
運|carry|うん|はこ|辶冖車
里|hometown/village|り|さと|
重|heavy|じゅう|おも|ノ里
動|move|どう|うご|ノ里力
働|work|どう|はたら|亻ノ里力
#11
研|polish|けん|と|石干
究|research|きゅう|きわ|穴ノ乙
質|quality|しつ||斤貝
問|question|もん|と|門口
答|answer|とう|こた|竹人一口
計|measure|けい|はか|言十
試|try|し|ため|言工戈
験|test|けん||馬人
馬|horse|ば|うま|
算|calculate|さん||竹目
数|count/number|すう|かず|米女攵
教|teach|きょう|おし|土子攵
科|subject|か||禾十
番|turn|ばん||ノ米田
号|number|ごう||口一乙
理|logic|り||王里
由|reason|ゆう|よし|田丨
料|fee|りょう||米十
#12
飯|meal|はん|めし|食厂又
親|parent|しん|おや|立木目儿
新|new|しん|あたら|立木斤
旅|trip|りょ|たび|方ノ人
族|tribe|ぞく||方矢
転|revolve|てん|ころ|車二厶
軽|lightweight|けい|かる|車又土
橋|bridge|きょう|はし|木口冂
駅|station|えき||馬尸
館|building|かん|やかた|食宀口
屋|roof/shop|おく|や|尸土厶
界|world|かい||田人
写|copy|しゃ|うつ|冖一
真|true|しん|ま|十目八
映|reflect|えい|うつ|日大冂
画|drawing|が||一田
歌|song|か|うた|口欠一
仕|serve|し|つか|亻士
事|matter|じ|こと|一口亅
私|I/private|し|わたし|禾厶
集|gather|しゅう|あつ|隹木
曜|weekday|よう||日隹
進|advance|しん|すす|辶隹
雑|miscellaneous|ざつ||木隹
短|short|たん|みじか|矢豆
登|climb|とう|のぼ|癶豆
発|depart|はつ||癶二儿
題|topic|だい||日頁
顔|face|がん|かお|立頁
頭|head|とう|あたま|豆頁
#13
鳥|bird|ちょう|とり|
鳴|chirp|めい|な|口鳥
島|island|とう|しま|鳥山
羽|feather|う|は|
習|learn|しゅう|なら|羽白
鉄|iron|てつ||金大ノ
羊|sheep|よう|ひつじ|
洋|ocean|よう||氵羊
美|beauty|び|うつく|羊大
着|wear|ちゃく|き|羊目
線|line|せん||糸白水
緑|green|りょく|みどり|糸水
紙|paper|し|かみ|糸氏
細|thin|さい|ほそ|糸田
組|group|そ|く|糸目一
絵|picture|かい|え|糸人二厶
漢|China|かん||氵艹口
#14
寒|cold|かん|さむ|宀二八
暑|hot|しょ|あつ|日土ノ
温|warm|おん|あたた|氵日皿
泳|swim|えい|およ|氵水
波|wave|は|なみ|氵皮
酒|alcohol|しゅ|さけ|氵酉
配|distribute|はい|くば|酉己
曲|bend|きょく|ま|日丨
歩|walk|ほ|ある|止小
走|run|そう|はし|
起|wake up|き|お|走己
返|return|へん|かえ|辶厂又
速|fast|そく|はや|辶木口
遅|late|ち|おそ|辶尸羊
回|times|かい|まわ|囗口
図|diagram|ず|はか|囗丶ノ
`;

/** `word|reading|meanings (/)`. Level is the highest level among its kanji. */
export const VOCAB = `
一|いち|one
一つ|ひとつ|one thing
二|に|two
二つ|ふたつ|two things
三|さん|three
三つ|みっつ|three things
口|くち|mouth
人|ひと|person
大きい|おおきい|big
小さい|ちいさい|small
山|やま|mountain
川|かわ|river
上|うえ|above
下|した|below
中|なか|inside
日|ひ|sun/day
月|つき|moon
木|き|tree
入る|はいる|to enter
十|じゅう|ten
力|ちから|strength
大人|おとな|adult
人口|じんこう|population
入口|いりぐち|entrance
一月|いちがつ|January
大小|だいしょう|large and small
女|おんな|woman
女の子|おんなのこ|girl
子|こ|child
王|おう|king
目|め|eye
白|しろ|white
白い|しろい|white
手|て|hand
上手|じょうず|skilful
下手|へた|unskilful
火|ひ|fire
火山|かざん|volcano
水|みず|water
土|つち|soil
千|せん|thousand
文|ぶん|sentence
天|てん|heavens
本|ほん|book
日本|にほん|Japan
日本人|にほんじん|Japanese person
刀|かたな|sword
石|いし|stone
右|みぎ|right
王子|おうじ|prince
水田|すいでん|paddy field
人目|ひとめ|public eye
左|ひだり|left
出る|でる|to go out
出口|でぐち|exit
立つ|たつ|to stand
生きる|いきる|to live
先生|せんせい|teacher
花|はな|flower
花火|はなび|fireworks
字|じ|character
学生|がくせい|student
大学|だいがく|university
休む|やすむ|to rest
体|からだ|body
名人|めいじん|expert
林|はやし|woods
森|もり|forest
四|よん|four
五|ご|five
六|ろく|six
七|なな|seven
八|はち|eight
九|きゅう|nine
人生|じんせい|life
文字|もじ|letter
左右|さゆう|left and right
百|ひゃく|hundred
男|おとこ|man
男の子|おとこのこ|boy
町|まち|town
村|むら|village
糸|いと|thread
赤い|あかい|red
青い|あおい|blue
空|そら|sky
空気|くうき|air
雨|あめ|rain
車|くるま|car
音|おと|sound
早い|はやい|early
年|とし|year
見る|みる|to see
見本|みほん|sample
貝|かい|shellfish
天気|てんき|weather
人気|にんき|popularity
玉|たま|ball
犬|いぬ|dog
正しい|ただしい|correct
正月|しょうがつ|New Year
足|あし|foot/leg
一年生|いちねんせい|first-year student
牛|うし|cow
竹|たけ|bamboo
米|こめ|rice
虫|むし|insect
耳|みみ|ear
お金|おかね|money
学校|がっこう|school
父|ちち|father
母|はは|mother
父母|ふぼ|parents
友だち|ともだち|friend
古い|ふるい|old
北|きた|north
今|いま|now
今日|きょう|today
今年|ことし|this year
正午|しょうご|noon
毛|け|hair/fur
心|こころ|heart
引く|ひく|to pull
西|にし|west
東|ひがし|east
南|みなみ|south
外|そと|outside
人間|にんげん|human
聞く|きく|to hear
長い|ながい|long
高い|たかい|tall/expensive
会う|あう|to meet
会社|かいしゃ|company
社会|しゃかい|society
何|なに|what
来る|くる|to come
来年|らいねん|next year
行く|いく|to go
自分|じぶん|oneself
半分|はんぶん|half
大切|たいせつ|important
多い|おおい|many
少し|すこし|a little
校長|こうちょう|principal
読む|よむ|to read
言う|いう|to say
話す|はなす|to speak
日本語|にほんご|Japanese language
書く|かく|to write
食べる|たべる|to eat
飲む|のむ|to drink
買う|かう|to buy
売る|うる|to sell
店|みせ|shop
書店|しょてん|bookshop
道|みち|road
近い|ちかい|near
遠い|とおい|far
今週|こんしゅう|this week
朝|あさ|morning
昼|ひる|noon
夜|よる|night
朝食|ちょうしょく|breakfast
雪|ゆき|snow
電気|でんき|electricity
電車|でんしゃ|train
春|はる|spring
夏|なつ|summer
秋|あき|autumn
冬|ふゆ|winter
寺|てら|temple
時間|じかん|time/hours
明るい|あかるい|bright
明日|あした|tomorrow
光|ひかり|light
太い|ふとい|thick
晴れ|はれ|clear weather
兄弟|きょうだい|siblings
姉|あね|older sister
妹|いもうと|younger sister
色|いろ|colour
思う|おもう|to think
海|うみ|sea
池|いけ|pond
決める|きめる|to decide
洗う|あらう|to wash
地下|ちか|underground
会場|かいじょう|venue
生活|せいかつ|daily life
作る|つくる|to make
使う|つかう|to use
住む|すむ|to live
食べ物|たべもの|food
飲み物|のみもの|drink
始める|はじめる|to begin
終わる|おわる|to end
持つ|もつ|to hold
指|ゆび|finger
投げる|なげる|to throw
主人|しゅじん|husband/master
悪い|わるい|bad
急ぐ|いそぐ|to hurry
意見|いけん|opinion
感じる|かんじる|to feel
感想|かんそう|impression
病気|びょうき|illness
病院|びょういん|hospital
医学|いがく|medical science
薬|くすり|medicine
死ぬ|しぬ|to die
都会|とかい|city
送る|おくる|to send
運動|うんどう|exercise
動く|うごく|to move
働く|はたらく|to work
重い|おもい|heavy
注意|ちゅうい|caution
急行|きゅうこう|express
研究|けんきゅう|research
質問|しつもん|question
答える|こたえる|to answer
時計|とけい|clock
試験|しけん|exam
馬|うま|horse
計算|けいさん|calculation
数学|すうがく|mathematics
教える|おしえる|to teach
科学|かがく|science
番号|ばんごう|number
一番|いちばん|first/best
理由|りゆう|reason
料理|りょうり|cooking
ご飯|ごはん|rice/meal
親|おや|parent
新しい|あたらしい|new
旅行|りょこう|trip
運転|うんてん|driving
軽い|かるい|light
橋|はし|bridge
駅|えき|station
映画|えいが|movie
映画館|えいがかん|cinema
部屋|へや|room
屋上|おくじょう|rooftop
写真|しゃしん|photograph
真ん中|まんなか|middle
歌|うた|song
歌う|うたう|to sing
仕事|しごと|work
私|わたし|I
集める|あつめる|to collect
曜日|ようび|day of the week
金曜日|きんようび|Friday
進む|すすむ|to advance
短い|みじかい|short
登る|のぼる|to climb
出発|しゅっぱつ|departure
問題|もんだい|problem
顔|かお|face
頭|あたま|head
食事|しょくじ|meal
計画|けいかく|plan
海外|かいがい|overseas
海水|かいすい|seawater
電池|でんち|battery
決して|けっして|never
工場|こうじょう|factory
作文|さくぶん|essay
物語|ものがたり|story
始まる|はじまる|to start
気持ち|きもち|feeling
主語|しゅご|subject (grammar)
注文|ちゅうもん|order
悪口|わるぐち|insult
急|きゅう|sudden
意外|いがい|unexpected
感心|かんしん|admiration
病人|びょうにん|sick person
医院|いいん|clinic
部分|ぶぶん|part
運ぶ|はこぶ|to carry
自動車|じどうしゃ|car
動物|どうぶつ|animal
重さ|おもさ|weight
息|いき|breath
息子|むすこ|son
里|さと|hometown
研ぐ|とぐ|to sharpen
究める|きわめる|to master
物質|ぶっしつ|substance
本質|ほんしつ|essence
気質|きしつ|temperament
問う|とう|to ask
学問|がくもん|learning
問答|もんどう|dialogue
答え|こたえ|answer
口答え|くちごたえ|talking back
計る|はかる|to measure
入試|にゅうし|entrance exam
試食|ししょく|tasting
体験|たいけん|experience
馬車|ばしゃ|carriage
子馬|こうま|foal
竹馬|たけうま|stilts
木馬|もくば|wooden horse
算数|さんすう|arithmetic
数|かず|number
人数|にんずう|number of people
数字|すうじ|numeral
少数|しょうすう|minority
多数|たすう|majority
教会|きょうかい|church
教科書|きょうかしょ|textbook
理科|りか|science (school subject)
内科|ないか|internal medicine
外科|げか|surgery
番人|ばんにん|guard
二番目|にばんめ|second
年号|ねんごう|era name
心理|しんり|psychology
地理|ちり|geography
自由|じゆう|freedom
料金|りょうきん|fee
食料|しょくりょう|food supplies
送料|そうりょう|shipping fee
朝ご飯|あさごはん|breakfast
昼ご飯|ひるごはん|lunch
夕ご飯|ゆうごはん|dinner
夕飯|ゆうはん|evening meal
飯|めし|cooked rice
父親|ちちおや|father
母親|ははおや|mother
親友|しんゆう|close friend
親切|しんせつ|kind
親子|おやこ|parent and child
新聞|しんぶん|newspaper
新年|しんねん|new year
新人|しんじん|newcomer
新車|しんしゃ|new car
新入生|しんにゅうせい|new student
新米|しんまい|novice
新月|しんげつ|new moon
旅|たび|journey
旅人|たびびと|traveller
旅館|りょかん|inn
旅先|たびさき|destination
水族館|すいぞくかん|aquarium
王族|おうぞく|royal family
自転車|じてんしゃ|bicycle
転ぶ|ころぶ|to fall over
運転手|うんてんしゅ|driver
転校|てんこう|changing schools
気軽|きがる|carefree
手軽|てがる|easy
軽食|けいしょく|light meal
会館|かいかん|hall
本館|ほんかん|main building
本屋|ほんや|bookstore
花屋|はなや|florist
八百屋|やおや|greengrocer
小屋|こや|hut
外界|がいかい|outside world
学界|がっかい|academic world
写す|うつす|to copy
写生|しゃせい|sketching
真っ白|まっしろ|pure white
真っ赤|まっか|bright red
真っ青|まっさお|deep blue
真夜中|まよなか|middle of the night
真心|まごころ|sincerity
真上|まうえ|directly above
真下|ました|directly below
真水|まみず|fresh water
映る|うつる|to be reflected
上映|じょうえい|screening
名画|めいが|famous painting
仕方|しかた|way of doing
仕上げる|しあげる|to finish off
仕切る|しきる|to partition
火事|かじ|fire (blaze)
大事|だいじ|important
工事|こうじ|construction
人事|じんじ|personnel affairs
何事|なにごと|what sort of thing
悪事|あくじ|wrongdoing
理事|りじ|director
私立|しりつ|private (institution)
私生活|しせいかつ|private life
私物|しぶつ|personal belongings
私見|しけん|personal opinion
駅長|えきちょう|stationmaster
新学年|しんがくねん|new school year
新作|しんさく|new work
新語|しんご|new word
新生活|しんせいかつ|new life
親しい|したしい|close (friendly)
親分|おやぶん|boss
親日|しんにち|pro-Japanese
旅立つ|たびだつ|to set off
長旅|ながたび|long journey
一人旅|ひとりたび|travelling alone
転じる|てんじる|to turn
転入|てんにゅう|moving in
転売|てんばい|resale
軽石|かるいし|pumice
館長|かんちょう|museum director
古本屋|ふるほんや|second-hand bookshop
米屋|こめや|rice shop
真空|しんくう|vacuum
真冬|まふゆ|midwinter
真夏|まなつ|midsummer
真昼|まひる|broad daylight
真北|まきた|due north
映写|えいしゃ|projection
画数|かくすう|stroke count
字画|じかく|strokes of a character
動画|どうが|video
仕立てる|したてる|to tailor
行事|ぎょうじ|event
物事|ものごと|things
見事|みごと|splendid
私語|しご|whispering
私学|しがく|private school
下界|げかい|the world below
一族|いちぞく|clan
書き写す|かきうつす|to copy out
鳥|とり|bird
島|しま|island
美しい|うつくしい|beautiful
着る|きる|to wear
紙|かみ|paper
細い|ほそい|thin
寒い|さむい|cold
暑い|あつい|hot
泳ぐ|およぐ|to swim
酒|さけ|alcohol
歩く|あるく|to walk
起きる|おきる|to get up
返す|かえす|to give back
速い|はやい|fast
遅い|おそい|late
地図|ちず|map
図書館|としょかん|library
`;

/** `word|meaning|level` */
export const KANA_VOCAB = `
ありがとう|thank you|1
こんにちは|hello|2
すみません|excuse me|3
ちょっと|a little|4
たくさん|a lot|5
もしもし|hello (on the phone)|6
いくら|how much|7
どうぞ|please, go ahead|8
だめ|no good|9
やっぱり|as expected|10
ぜんぜん|not at all|11
そろそろ|soon|12
`;

/** Pairs of kanji that look alike. */
export const SIMILAR = '人入 日目 大犬 大太 右石 王玉 王主 白百 千午 牛午 力刀 東車 間聞 問聞 体休';
