/*
 * SergasApp
 *
 * Copyright (C) 2012  Manuel Rego Casasnovas <rego@igalia.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

document.addEventListener("deviceready", onDeviceReady, false);

// URL base da aplicación de citas do SERGAS
var BASE_URL = "https://extranet.sergas.es/cita/"

// Número máximo de veces que se intenta facer a conexión
var MAX_CALLS = 3;

// Modo de depuración
var DEBUG = false;

// Contador de intentos de conexión
var calls = 0;

// Referencia á base de datos
var db;

// Array de tarxetas sanitarias cos seus datos, cargarase dende a base de datos
var cards;

// Tarxeta seleccionada
var selectedCard = null;

// Array de posibles días para as consultas
var days;

// Array de posibles horas para as consultas
var hours;

// Hora seleccionada
var selectedHour = 0;

// Array de citas
var appointments;

// Cita seleccionada
var selectedAppointment = null;


function onDeviceReady() {
    hideCloseLinkIfNotAndroid();

    db = window.openDatabase("CardsDB", "1.0", "Cards DataBase", 200000);
    db.transaction(populateDB, errorCB, successCB);

    loadCards();
}

function hideCloseLinkIfNotAndroid() {
    if (device.platform != "Android") {
        $("#link_salir").hide();
    }
}

function populateDB(tx) {
    // Cada tarxeta terá un "id" autoxerado e un alias para ser referenciada
    // polo usuario. O resto son os campos necesarios para solicitar citas
    tx.executeSql("CREATE TABLE IF NOT EXISTS CARD (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "alias, " +
                "t_fecha, " +
                "t_apellidos1, " +
                "t_apellidos2, " +
                "t_sexo, " +
                "t_control, " +
                "n_cabecera, " +
                "n_cuerpo)");
}

function errorCB(tx, err) {
    log("Error processing SQL: " + err);
}

function successCB() {
    log("DB success");
}

function loadCards() {
    db.transaction(getCardsFromDB, errorCB);
}

function getCardsFromDB(tx) {
    tx.executeSql("SELECT * FROM CARD ORDER BY alias", [], cardsSuccess, errorCB);
}

function cardsSuccess(tx, results) {
    cards = new Array();

    var len = results.rows.length;
    log("Rows: " + len);

    for ( var i = 0; i < len; i++) {
        var item = results.rows.item(i);
        cards[i] = item;
        log("ID: " + item.id + " Alias: " + item.alias);
    }

    fillCardsList();
}

function fillCardsList() {
    var list = $("#lista");
    list.html("");

    for ( var i = 0; i < cards.length; i++) {
        list.append(createLiCard(i));
    }
    list.listview("destroy").listview();
}

function createLiCard(index) {
    var li = $(document.createElement("li"));
    li.append($(document.createElement("h3")).html(cards[index].alias));
    li.append(createUlCardOperations(index));
    return li
}

function createUlCardOperations(index) {
    var ul = $(document.createElement("ul"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='initAppointment(" + index + ");'>Solicitar cita</a>"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='initCheckAppointments(" + index + ");'>Consultar citas</a>"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='editCard(" + index + ");'>Editar tarxeta</a>"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='removeCard(" + index + ");'>Borrar tarxeta</a>"));
    return ul;
}

function initAppointment(index) {
    if (isOnline()) {
        calls = 0;
        startRequestAppointment(index);
    } else {
        navigator.notification.alert(
                "Necesita estar conectado a Internet para poder solicitar unha cita",
                null,
                "Problema de conexión",
                "Aceptar"
            );
    }
}

/*
 * Esta función e necesario chamala dúas veces, xa que moitas veces a primeira
 * fallan as peticións.
 *
 * Por iso se utiliza a variable "calls" que conta os intentos de conexión.
 */
function startRequestAppointment(index) {
    $.mobile.showPageLoadingMsg();

    log("Appointment: " + cards[index].id + " Alias: " + cards[index].alias);

    // Hai que facer as peticións por GET para que a aplicación non falle
    $.get(BASE_URL + "inicioCI.asp", null,
            function(data) {
            }
        );
    $.get(BASE_URL + "paso2.asp?T=S", null,
            function(data) {
            }
        );

    var values = {
        "n_cabecera": cards[index].n_cabecera,
        "n_cuerpo": cards[index].n_cuerpo,
        "t_apellidos1": cards[index].t_apellidos1,
        "t_apellidos2": cards[index].t_apellidos2,
        "t_control": cards[index].t_control,
        "t_fecha": cards[index].t_fecha,
        "t_sexo": cards[index].t_sexo
    };

    log("n_cabecera: " + values.n_cabecera);
    log("n_cuerpo: " + values.n_cuerpo);
    log("t_apellidos1: " + values.t_apellidos1);
    log("t_apellidos2: " + values.t_apellidos2);
    log("t_control: " + values.t_control);
    log("t_fecha: " + values.t_fecha);
    log("t_sexo: " + values.t_sexo);

    // Petición por post que simula encher o formulario cos datos da tarxeta
    $.post(BASE_URL + "paso3.asp", values,
        function(data) {

            if ($("#menuOperaciones", data).text()) {
                log("Pantalla inicial intento " + calls);
                if (calls < MAX_CALLS) {
                    log("Volver a intentar");
                    calls++;
                    startRequestAppointment(index);
                    return;
                }
                log("Non máis intentos");
            }

            if ($(".p_cita_a", data).length) {
                $.mobile.hidePageLoadingMsg();

                $.mobile.changePage("#solicitude_cita");

                log("Number: " + $(".p_cita_a", data).length);
                log("Médico: " + $(".p_cita_a", data).first().text());
                log("Centro: " + $(".p_cita_a", data).last().text());

                $("#medico").val($(".p_cita_a", data).first().text());
                $("#centro").val($(".p_cita_a", data).last().text());

                // tipoActoCI: Consulta -> 1, Recetas -> 2
                days = new Array();

                $("#s_fecha", data).children().each(function(index) {
                    if ($(this).attr("value")) {
                        log($(this).attr("value"));

                        // A estructura que se parsea ten o seguinte formatio:
                        // diaselecSTR = dias(i)|hMinimasDEM(i)|lDias(i)|lMeses(i)|lAnhos(i)|hMinimasADM(i)|hMaximasADM(i)|hMinimasDEM(i)|hMaximasDEM(i)|i|fTipoDistribucion(i)
                        // * ADM -> receitas
                        // * DEM -> consulta enfermidade
                        // Exemplo: xoves, 19 de xaneiro|09:00|19|1|2012|09:38|13:22|09:00|13:29|10|2
                        days.push($(this).attr("value").split("|"));
                    } else {
                        log("Without value at index: " + index);
                    }
                });

                fillDays();
            } else {
                $.mobile.hidePageLoadingMsg();
                navigator.notification.alert(
                        "Revise os datos da tarxeta sanitaria e inténteo de novo máis tarde",
                        null,
                        "Erro durante a solicitude",
                        "Aceptar"
                    );
            }

        }
    );

}

function initCheckAppointments(index) {
    if (isOnline()) {
        calls = 0;
        checkAppointments(index);
    } else {
        navigator.notification.alert(
                "Necesita estar conectado a Internet para poder consultar as citas",
                null,
                "Problema de conexión",
                "Aceptar"
            );
    }
}

function checkAppointments(index) {
    $.mobile.showPageLoadingMsg();

    log("Check appointments: " + cards[index].id + " Alias: " + cards[index].alias);

    // Hai que facer as peticións por GET para que a aplicación non falle
    $.get(BASE_URL + "inicioCI.asp", null,
            function(data) {
            }
        );
    $.get(BASE_URL + "paso2.asp?T=C", null,
            function(data) {
            }
        );

    var values = {
        "n_cabecera": cards[index].n_cabecera,
        "n_cuerpo": cards[index].n_cuerpo,
        "t_apellidos1": cards[index].t_apellidos1,
        "t_apellidos2": cards[index].t_apellidos2,
        "t_control": cards[index].t_control,
        "t_fecha": cards[index].t_fecha,
        "t_sexo": cards[index].t_sexo
    };

    // Petición por post que simula encher o formulario cos datos da tarxeta
    $.post(BASE_URL + "paso3.asp", values,
        function(data) {

            if ($("#menuOperaciones", data).text()) {
                log("Pantalla inicial intento " + calls);
                if (calls < MAX_CALLS) {
                    log("Volver a intentar");
                    calls++;
                    checkAppointments(index);
                    return;
                }
                log("Non máis intentos");
            }

            $.mobile.hidePageLoadingMsg();

            var trs = $("tr[valign='middle']", data);
            var number = trs.length;
            if (number) {
                $.mobile.changePage("#citas");

                appointments = new Array();
                for (i=0; i < number ; i++) {
                    var tr = trs.eq(i);
                    appointment = new Object();
                    appointment.codCita = $("#codCita" + i, data).val();
                    appointment.dia = $(".p_cita_az", tr).eq(0).text();
                    appointment.hora = $(".p_cita_az", tr).eq(1).text();
                    appointment.tipo = $(".p_cita_az", tr).eq(2).text();
                    appointment.medico = $(".p_cita_az", tr).eq(3).text();
                    appointment.centro = $(".p_cita_az", tr).eq(4).text();
                    appointments[i] = appointment;
                }

                fillAppointmentsList();
            } else {
                if ($(".p_cita_a", data).length == 1) {
                    navigator.notification.alert(
                            "Non ten citas para os vindeiros días",
                            null,
                            "Sen citas",
                            "Aceptar"
                        );

                    $.mobile.changePage("#inicio");
                } else {
                    navigator.notification.alert(
                            "Revise os datos da tarxeta sanitaria e inténteo de novo máis tarde",
                            null,
                            "Erro durante a consulta",
                            "Aceptar"
                        );
                }
            }

        }
    );

}

function fillAppointmentsList() {
    var list = $("#lista_citas");
    list.html("");

    for ( var i = 0; i < appointments.length; i++) {
        list.append(createLiAppointment(i));
    }
    list.listview("destroy").listview();
}

function createLiAppointment(index) {
    var li = $(document.createElement("li"));
    li.append($(document.createElement("h3")).html(appointments[index].dia + " - " + appointments[index].hora));
    li.append($(document.createElement("p")).html("<strong>" + appointments[index].medico +
            "</strong><br /><em>" + appointments[index].tipo +
            "</em><br />"+ appointments[index].centro));
    li.append(createUlAppointmentOperations(index));
    return li;
}

function createUlAppointmentOperations(index) {
    var ul = $(document.createElement("ul"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='cancelAppointment(" + index + ");'>Cancelar cita</a>"));
    return ul;
}

function cancelAppointment(index) {
    selectedAppointment = index;

    navigator.notification.confirm(
        "¿Está seguro?",
        onConfirmCancelAppointment,
        "Cancelar cita",
        "Si,Non"
    );
}

function onConfirmCancelAppointment(button) {
    if (button == 1) {
        var values = {
            "codCitas": appointments[selectedAppointment].codCita
        };

        $.post(BASE_URL + "marcoListadoCitasElim.asp", values,
            function(data) {
                var params = $("#codCita0", data).val();
                params += "," + $("#codServicio0", data).val();
                params += "," + $("#hora0", data).val();
                params += "," + $("#fecha0", data).val();
                params += "," + $("#forzar0", data).val();

                var values = {
                        "nParams": 1,
                        "parametros": params
                };

                $.post(BASE_URL + "cancelarCita.asp", values);

                loadCards();
                $.mobile.changePage("#inicio");
            }
        );
    }
}

function updateDays() {
    resetSelectedDay();
    fillDays();
}

function fillDays() {
    var dia = $("#dia");
    dia.empty();

    dia.change(showDayInfo);

    var firstAvailableDay = null;

    for (var i = 0; i < days.length; i++) {
        if (checkDayAvailability(i)) {
            if (!firstAvailableDay) {
                firstAvailableDay = i;
            }
            dia.append("<option value='" + i + "'>" + days[i][0] +"</option>");
        }
    }

    dia.select(firstAvailableDay);
    dia.selectmenu("refresh");
    showDayInfo();
}

function checkDayAvailability(index) {
    var tipo = $("#tipo").val();

    if (tipo == 2) {
        return days[index][5] != "99:99";
    } else {
        return days[index][7] != "99:99";
    }
}

function resetSelectedDay() {
    $("#dia").val(null);
    $("#rango").val("");
    $("#alerta").val("");
}

function showDayInfo() {
    var i = $("#dia").val();

    var tipo = $("#tipo").val();
    var rango;
    if (tipo == 2) {
        rango = days[i][5] + " a " + days[i][6];

        $("#hora").val(days[i][5].split(":")[0]);
        $("#minutos").val(days[i][5].split(":")[1]);
    } else {
        rango = days[i][7] + " a " + days[i][8];

        $("#hora").val(days[i][7].split(":")[0]);
        $("#minutos").val(days[i][7].split(":")[1]);
    }
    log("Rango: " + rango);
    $("#rango").val(rango);

    if (days[i][10] == 1) {
        $("#alerta").val("O/a profesional non poderá atenderlle o día seleccionado.\n" +
                "Remitiráselle a un/unha substituto/a");
    }
}

function requestAppointment() {
    var i = $("#dia").val();

    var dia = new String(days[i][2]);
    var mes = new String(days[i][3]);
    var anho = new String(days[i][4]);

    if (dia.length == 1) {
        dia = "0" + dia;
    }

    if (mes.length == 1) {
        mes = "0" + mes;
    }

    var values = {
        "fecha": dia + "/" + mes + "/" + anho,
        "fechaIdonea": anho + mes + dia,
        "fechausa": mes + "/" + dia + "/" + anho,
        "hora": $("#hora").val(),
        "indiceDia": new Number(i) + 1,
        "minutos": $("#minutos").val(),
        "tipoActoCI": $("#tipo").val(),
        "tipoDistrib": days[i][10]
    };

    log("fecha: " + values.fecha);
    log("fechaIdonea: " + values.fechaIdonea);
    log("fechausa: " + values.fechausa);
    log("hora: " + values.hora);
    log("indiceDia: " + values.indiceDia);
    log("minutos: " + values.minutos);
    log("tipoActoCI: " + values.tipoActoCI);
    log("tipoDistrib: " + values.tipoDistrib);

    $.mobile.showPageLoadingMsg();

    $.get(BASE_URL + "paso5.asp", values,
        function(data) {
            $.mobile.hidePageLoadingMsg();

            if ($(".p_cita_az", data).length) {
                var message = $(".p_cita_az", data).eq(0).text() + "\n" +
                        $(".p_cita_az", data).eq(2).text() + "\n\n";

                if ($(".p_cita", data).length == 11) {
                    message +=
                            "Médico: " + $(".p_cita", data).eq(3).find("strong").text() + "\n" +
                            "Data: " + $(".p_cita", data).eq(5).find("b").text() + "\n" +
                            "Hora: " + $(".p_cita", data).eq(7).find("strong").text();
                } else {
                    message +=
                        "Médico: " + $(".p_cita", data).eq(3).find("strong").text() + "\n" +
                        "Substituindo a: " + $(".p_cita", data).eq(5).find("strong").text() + "\n" +
                        "Data: " + $(".p_cita", data).eq(7).find("b").text() + "\n" +
                        "Hora: " + $(".p_cita", data).eq(9).find("strong").text();
                }
                navigator.notification.alert(
                        message,
                        null,
                        "Xa ten algunha cita",
                        "Aceptar"
                    );

                $.mobile.changePage("#inicio");
            } else {
                $.mobile.changePage("#confirmar_cita");

                $("#centro2").val($(".p_cita", data).eq(6).text());
                $("#medico2").val($(".p_cita", data).eq(7).find("strong").text());
                $("#dia2").val($(".p_cita", data).eq(10).find("strong").text());
                $("#tipo2").val($(".p_cita", data).eq(12).find("strong").eq(0).text());

                hours = new Array();

                var i = 0;

                $("#s_hora", data).children().each(function(index) {
                    log("Value: " + $(this).attr("value"));
                    log("Selected: " + $(this).attr("selected"));

                    // A estructura que se parsea ten o seguinte formatio:
                    // hCitaArr = hora|codHueco1|nomprof & " " & apel1prof & " " & apel2prof|codcentro|nomcons
                    // Exemplo: 09:00|359473467|
                    hours.push($(this).attr("value").split("|"));

                    if ($(this).attr("selected") == "selected") {
                        selectedHour = i;
                    }
                    i++;
                });

                fillHours();
            }
        }
    );

}

function fillHours() {
    var hora = $("#hora2");
    hora.empty();

    hora.change(showHourInfo);

    for (var i = 0; i < hours.length; i++) {
        hora.append("<option value='" + i + "'>" + hours[i][0] +"</option>");
    }

    hora.select(selectedHour);
    hora.selectmenu("refresh");
}

function showHourInfo() {
    if (days[$("#dia").val()][10] == 1) {
        var i = $("#hora2").val();
        $("#substituto2").val(hours[i][2]);
        $("#centro2").val(hours[i][4]);
    }
}

function confirmAppointment() {
    var i = $("#hora2").val();

    var values = {
            "codHueco": hours[i][1],
            "horaCita": hours[i][0]
        };

    log("codHueco: " + values.codHueco);
    log("horaCita: " + values.horaCita);

    $.mobile.showPageLoadingMsg();

    $.get(BASE_URL + "paso6.asp", values,
        function(data) {
            $.mobile.hidePageLoadingMsg();

            if ($(".p_cita_a", data).eq(1).text() == "") {
                navigator.notification.alert(
                        "Por favor inténteo de novo",
                        null,
                        "Erro confirmando a cita",
                        "Aceptar"
                    );
            } else {
                navigator.notification.alert(
                        $(".p_cita_a", data).eq(1).text(),
                        null,
                        "Cita confirmada",
                        "Aceptar"
                    );
            }

            $.mobile.changePage("#inicio");
        }
    );

}

function editCard(index) {
    $.mobile.changePage("#editar_tarxeta");

    selectedCard = index;

    $("#alias").val(cards[index].alias);
    $("#t_fecha").val(cards[index].t_fecha);
    $("#t_apellidos1").val(cards[index].t_apellidos1);
    $("#t_apellidos2").val(cards[index].t_apellidos2);
    $("#t_sexo").val(cards[index].t_sexo);
    $("#t_control").val(cards[index].t_control);
    $("#n_cabecera").val(cards[index].n_cabecera);
    $("#n_cuerpo").val(cards[index].n_cuerpo);
}

function saveCard() {
    db.transaction(updateCardDB, errorCB, successCB);

    loadCards();
    $.mobile.changePage("#inicio");
}

function updateCardDB(tx) {
    var sql;

    if (selectedCard == null) {
        sql = "INSERT INTO CARD (alias, t_fecha, t_apellidos1, t_apellidos2, t_sexo, t_control, n_cabecera, n_cuerpo) VALUES (" +
            "'" + $("#alias").val() + "', " +
            "'" + $("#t_fecha").val() + "', " +
            "'" + $("#t_apellidos1").val() + "', " +
            "'" + $("#t_apellidos2").val() + "', " +
            "'" + $("#t_sexo").val() + "', " +
            "'" + $("#t_control").val() + "', " +
            "'" + $("#n_cabecera").val() + "', " +
            "'" + $("#n_cuerpo").val() + "');";
    } else {
        sql = "UPDATE CARD SET alias='" + $("#alias").val() + "', " +
            "t_fecha='" + $("#t_fecha").val() + "', " +
            "t_apellidos1='" + $("#t_apellidos1").val() + "', " +
            "t_apellidos2='" + $("#t_apellidos2").val() + "', " +
            "t_sexo='" + $("#t_sexo").val() + "', " +
            "t_control='" + $("#t_control").val() + "', " +
            "n_cabecera='" + $("#n_cabecera").val() + "', " +
            "n_cuerpo='" + $("#n_cuerpo").val() + "' " +
            "WHERE id='" + cards[selectedCard].id + "';";
    }

    tx.executeSql(sql);
}

function newCard() {
    $.mobile.changePage("#editar_tarxeta");

    selectedCard = null;

    $("#alias").val(null);
    $("#t_fecha").val(null);
    $("#t_apellidos1").val(null);
    $("#t_apellidos2").val(null);
    $("#t_sexo").val(null);
    $("#t_control").val(null);
    $("#n_cabecera").val(null);
    $("#n_cuerpo").val(null);
}

function removeCard(index) {
    selectedCard = index;

    navigator.notification.confirm(
            "¿Está seguro?",
            onConfirmRemoveCard,
            "Eliminar tarxeta",
            "Si,Non"
        );
}

function onConfirmRemoveCard(button) {
    if (button == 1) {
        db.transaction(deleteCardDB, errorCB, successCB);

        loadCards();
        $.mobile.changePage("#inicio");
    }
}

function deleteCardDB(tx) {
    tx.executeSql("DELETE FROM CARD WHERE id='" + cards[selectedCard].id + "';");
}

function isOnline() {
    var networkState = navigator.network.connection.type;
    return (networkState != Connection.NONE);
}

function help(field) {
    var message;
    var title;

    switch (field) {
        case "alias":
            title = "Alias tarxeta";
            message = "Nome para indentificar a tarxeta sanitaria na aplicación SergasApp";
            break;
        case "t_fecha":
            title = "Data de nacemento";
            message = "6 primeiros díxitos da tarxeta\n\n" +
                    "Representan a data de nacemento co seguinte formato \"AAMMDD\"\n\n" +
                    "Exemplo: \"25 de marzo de 1971\" sería \"710325\"";
            break;
        case "t_apellidos1":
            title = "Iniciais 1";
            message = "2 letras despois dos primeiros 6 números da tarxeta\n\n" +
                    "Iniciais dos dous apelidos\n\n" +
                    "Exemplo: \"García Pérez\" sería \"GP\"";
            break;
        case "t_apellidos2":
            title = "Iniciais 2";
            message = "Seguintes 2 letras despois das iniciais dos apelidos da tarxeta\n\n" +
                    "Segunda letra dos dous apelidos\n\n" +
                    "Exemplo: \"García Pérez\" sería \"AE\"";
            break;
        case "t_sexo":
            title = "Sexo";
            message = "Seguinte díxito da tarxeta despois das letras dos apelidos\n\n" +
                    "Representa o sexo cun número (0: mulller, 1: home)\n\n" +
                    "Exemplo: \"muller\" sería \"0\"";
            break;
        case "t_control":
            title = "Control";
            message = "Seguintes 3 números da tarxeta despois do díxito de sexo\n\n" +
                    "É un número de control de erros\n\n" +
                    "Exemplo: \"027\"";
            break;
        case "n_cabecera":
            title = "Cabeciera SS";
            message = "Primeiros 2 díxitos antes da barra na tarxeta\n\n" +
                    "Son os primeros díxitos do número da Seguridade Social (representan a provincia)\n\n" +
                    "Exemplo: \"Pontevedra\" sería \"36\"";
            break;
        case "n_cuerpo":
            title = "Corpo SS";
            message = "10 díxitos despois da barra na tarxeta\n\n" +
                    "Son os díxitos restantes do número da Seguridade Social\n\n" +
                    "Exemplo: \"1234567890\"";
            break;
    }

    navigator.notification.alert(
            message,
            null,
            "Axuda: " + title,
            "Cerrar"
        );
}

function log(message) {
    if (DEBUG) {
        console.log(message);
    }
}

function exitApp() {
    device.exitApp();
}
