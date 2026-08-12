const CLOUD_VRM_MODEL_PATHS_TEXT = `
AdashinoKan-Bankara/AdashinoKan-Bankara.vrm
AdashinoKan-Normal/AdashinoKan-Normal.vrm
AdashinoKan-Roman/AdashinoKan-Roman.vrm
aldina/aldina.vrm
aldina_naked/aldina_naked.vrm
Amiya/Amiya.vrm
Ash1.0/Ash1.0.vrm
Astarte1.0.0-A3/Astarte1.0.0-A3.vrm
Azuki_Def/Azuki_Def.vrm
Azuki_T/Azuki_T.vrm
Azuki_T_Human/Azuki_T_Human.vrm
BlueMallow_39studio/BlueMallow_39studio.vrm
BlueMallow_BoneReducedVer_39studio/BlueMallow_BoneReducedVer_39studio.vrm
BlueMallow_PerfectSync_39studio/BlueMallow_PerfectSync_39studio.vrm
calmelo-mint/calmelo-mint.vrm
calmelo-pink/calmelo-pink.vrm
calmelo-vamp/calmelo-vamp.vrm
CH_001_imiut_v1.01/CH_001_imiut_v1.01.vrm
CH_004_kei_a_v1.01/CH_004_kei_a_v1.01.vrm
CH_004_kei_b_v1.01/CH_004_kei_b_v1.01.vrm
CH_007_unkt_off_bonnet_v1_00/CH_007_unkt_off_bonnet_v1_00.vrm
CH_007_unkt_v1_00/CH_007_unkt_v1_00.vrm
CH_02_kronos_v1.03/CH_02_kronos_v1.03.vrm
Churro_v2VRM/Churro_v2VRM.vrm
Elinyaa/Elinyaa.vrm
Ichijiku_VRM_sotai/Ichijiku_VRM_sotai.vrm
Ichijiku_VRM_Type1/Ichijiku_VRM_Type1.vrm
Ichijiku_VRM_Type2/Ichijiku_VRM_Type2.vrm
IMERIS/IMERIS.vrm
Kokoa_VRM/Kokoa_VRM.vrm
kyoko/kyoko.vrm
Lazlotte/Lazlotte.vrm
Lena_ver1.02(VRM)/Lena_ver1.02(VRM).vrm
Lilium_ver1.01 (VRM)/Lilium_ver1.01 (VRM).vrm
Lilou_VRM/Lilou_VRM.vrm
Maca/Maca.vrm
Maple_1.0/Maple_1.0.vrm
Mariel/Mariel.vrm
mill_lily/mill_lily.vrm
mill_lily_2/mill_lily_2.vrm
mill_lily_CV1/mill_lily_CV1.vrm
mill_lily_CV1_2/mill_lily_CV1_2.vrm
mill_lily_CV2/mill_lily_CV2.vrm
mill_lily_CV2_2/mill_lily_CV2_2.vrm
Mira chan VRM/Mira chan VRM.vrm
Mira chan VRM one piece dress/Mira chan VRM one piece dress.vrm
miru/miru.vrm
Misty_VRM/Misty_VRM.vrm
NecoMaid_Premium/NecoMaid_Premium.vrm
necomaid_rich/necomaid_rich.vrm
Neige/Neige.vrm
NEKONA.01/NEKONA.01.vrm
nitco/nitco.vrm
P03_Temebro_forVroid_A1/P03_Temebro_forVroid_A1.vrm
P03_Temebro_forVroid_A2/P03_Temebro_forVroid_A2.vrm
P03_Temebro_forVroid_B1/P03_Temebro_forVroid_B1.vrm
P03_Temebro_forVroid_B2/P03_Temebro_forVroid_B2.vrm
P03_Temebro_forVroid_C/P03_Temebro_forVroid_C.vrm
QuQu_U/QuQu_U.vrm
Rainy_1.00/Rainy_1.00.vrm
RearAlice_1.0/RearAlice_1.0.vrm
Rilian_vrm/Rilian_vrm.vrm
RINDO_Full/RINDO_Full.vrm
RINDO_Original/RINDO_Original.vrm
Rosetta/Rosetta.vrm
Ruiko/Ruiko.vrm
Rushina_1.00_VRM/Rushina_1.00_VRM.vrm
Sephira_Nomal_2.1b/Sephira_Nomal_2.1b.vrm
Sephira_Swimwear_2.1/Sephira_Swimwear_2.1.vrm
Shaclo_Winter/Shaclo_Winter.vrm
sikirei_Rei_VRM/sikirei_Rei_VRM.vrm
Strela_VRM/Strela_VRM.vrm
syaru/syaru.vrm
type-a/type-a.vrm
Uketsukejou_1.0/Uketsukejou_1.0.vrm
VRM_KAKO_V1.03_DEFF_T/VRM_KAKO_V1.03_DEFF_T.vrm
VRM_KAKO_V1.03_USUGI_T/VRM_KAKO_V1.03_USUGI_T.vrm
Wolf_ver1.00(VRM)/Wolf_ver1.00(VRM).vrm
Wolferia/Wolferia.vrm
Yawl_Dress/Yawl_Dress.vrm
YM_CH_03_Notia_v1.01/YM_CH_03_Notia_v1.01.vrm
YM_CH_06_Shiratori_v1.00/YM_CH_06_Shiratori_v1.00.vrm
Yuu/Yuu.vrm
Yuu uwaginasi/Yuu uwaginasi.vrm
Zwei_VRM/Zwei_VRM.vrm
モナ Ver.1/モナ Ver.1.vrm
モナ Ver.2/モナ Ver.2.vrm
`;

/** 返回与 Server 兼容的固定云 VRM 相对路径；无输入，返回去空行目录，不访问文件系统或网络。 */
export function getApplicationCloudVrmModelPaths(): readonly string[] {
  return CLOUD_VRM_MODEL_PATHS_TEXT.trim().split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
