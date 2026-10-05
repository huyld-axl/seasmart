-- 078_update_certificate_type_name_en_cv_cn.sql
-- Cập nhật name_en khớp chính xác với nhãn tiếng Anh trong template CV tiếng Trung

SET NAMES utf8mb4;

-- DOCUMENT
UPDATE certificate_type SET name_en = 'PASSPORT'                              WHERE code = 'PASSPORT';
UPDATE certificate_type SET name_en = 'SEAMAN BOOK'                           WHERE code = 'SEAMAN_BOOK';
UPDATE certificate_type SET name_en = 'SEAFARER IDENTITY DOCUMENT (S.P.)'     WHERE code = 'SEAFARER_ID_CARD';

-- COC (row 20 - giữ tên theo chức danh, thêm (COC))
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - MASTER (COC)'            WHERE code = 'MASTER';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - CHIEF MATE (COC)'        WHERE code = 'CHIEF-MATE';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - CHIEF ENGINEER (COC)'    WHERE code = 'CHIEF-ENGINEER';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - SECOND ENGINEER (COC)'   WHERE code = 'SECOND-ENGINEER';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - OOW DECK (COC)'          WHERE code = 'OOW-DECK';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - OOW ENGINE (COC)'        WHERE code = 'OOW-ENGINE';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - WATCHKEEPING (COC)'      WHERE code = 'WATCHKEEPING-DECK';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - DECK (COC)'              WHERE code = 'COMPETENCY_DECK';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - ENGINE (COC)'            WHERE code = 'COMPETENCY_ENGINE';
UPDATE certificate_type SET name_en = 'CERTIFICATE OF COMPETENCY - RADIO (COC)'             WHERE code = 'COMPETENCY_RADIO';

-- GMDSS (row 21)
UPDATE certificate_type SET name_en = 'GMDSS'                                               WHERE code = 'GMDSS-GOC';

-- STCW cơ bản (rows 23-30)
UPDATE certificate_type SET name_en = 'BASIC TRAINING'                                      WHERE code = 'BASIC_TRAINING';
UPDATE certificate_type SET name_en = 'PROFICIENCY IN SURVIVAL CRAFT AND RESCUE BOATS'      WHERE code = 'PSCRB';
UPDATE certificate_type SET name_en = 'TRAINING IN ADVANCED FIRE-FIGHTING'                  WHERE code = 'AFF';
UPDATE certificate_type SET name_en = 'TRAINING IN MEDICAL FIRST AID'                       WHERE code = 'MEFA';
UPDATE certificate_type SET name_en = 'TRAINING IN MEDICAL CARE'                            WHERE code = 'MC';
UPDATE certificate_type SET name_en = 'SECURITY AWARENESS TRAINING'                         WHERE code = 'SECURITY_AWARENESS';
UPDATE certificate_type SET name_en = 'SEAFARERS WITH DESIGNATED SECURITY DUTIES'           WHERE code = 'SECURITY_DUTIES';
UPDATE certificate_type SET name_en = 'PROFICIENCY FOR SHIP SECURITY OFFICER'               WHERE code = 'SSO';

-- Y tế (row 31)
UPDATE certificate_type SET name_en = 'MEDICAL CERTIFICATE FOR SEAFARERS'                   WHERE code = 'MEDICAL_FITNESS';

-- Tanker (rows 32-36)
UPDATE certificate_type SET name_en = 'CHEMICAL TANKER FAMILIARIZATION COURSE'              WHERE code = 'TANKER_CHEMICAL';
UPDATE certificate_type SET name_en = 'CHEMICAL TANKER ADVANCE OPERATION'                   WHERE code = 'TANKER-CHEM-ADV';
UPDATE certificate_type SET name_en = 'OIL TANKER FAMILIARIZATION COURSE'                   WHERE code = 'TANKER_OIL';
UPDATE certificate_type SET name_en = 'OIL TANKER ADVANCE OPERATION'                        WHERE code = 'TANKER-OIL-ADV';
UPDATE certificate_type SET name_en = 'INERT GAS & CRUDE OIL WASHING'                       WHERE code = 'INERT_GAS_CRUDE_OIL_WASHING';

-- Navigation / Radar (rows 37-39)
UPDATE certificate_type SET name_en = 'RADAR OBSERVATION/SIMULATOR'                         WHERE code = 'RADAR_OBSERVATION';
UPDATE certificate_type SET name_en = 'ELECTRONIC NAVIGATIONAL AIDS'                        WHERE code = 'ELECTRONIC_NAV_AIDS';
UPDATE certificate_type SET name_en = 'A.R.P.A.'                                            WHERE code = 'ARPA';

-- Management (row 40)
UPDATE certificate_type SET name_en = 'SHIPBOARD MANAGEMENT COURSE'                         WHERE code = 'SHIPBOARD_MANAGEMENT';

-- COVID (row 41)
UPDATE certificate_type SET name_en = 'COVID-19 VACCINATION CERTIFICATE'                    WHERE code = 'COVID19_VACCINATION';
