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


function onDeviceReady() {
    db = window.openDatabase("CardsDB", "1.0", "Cards DataBase", 200000);
    db.transaction(populateDB, errorCB, successCB);

    loadCards();
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
    console.log("Error processing SQL: " + err);
}

function successCB() {
    console.log("DB success");
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
    console.log("Rows: " + len);

    for ( var i = 0; i < len; i++) {
        var item = results.rows.item(i);
        cards[i] = item;
        console.log("ID: " + item.id + " Alias: " + item.alias);
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
            "<a onClick='editCard(" + index + ");'>Editar tarxeta</a>"));
    ul.append($(document.createElement("li")).html(
            "<a onClick='removeCard(" + index + ");'>Borrar tarxeta</a>"));
    return ul;
}

function initAppointment(index) {
    calls = 0;
    appointment(index);
}

/*
 * Esta función e necesario chamala dúas veces, xa que moitas veces a primeira
 * fallan as peticións.
 *
 * Por iso se utiliza a variable "calls" que conta os intentos de conexión.
 */
function appointment(index) {
    $.mobile.showPageLoadingMsg();

    console.log("Appointment: " + cards[index].id + " Alias: " + cards[index].alias);

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

    console.log("n_cabecera: " + values.n_cabecera);
    console.log("n_cuerpo: " + values.n_cuerpo);
    console.log("t_apellidos1: " + values.t_apellidos1);
    console.log("t_apellidos2: " + values.t_apellidos2);
    console.log("t_control: " + values.t_control);
    console.log("t_fecha: " + values.t_fecha);
    console.log("t_sexo: " + values.t_sexo);

    // Petición por post que simula encher o formulario cos datos da tarxeta
    $.post(BASE_URL + "paso3.asp", values,
        function(data) {

            if ($("#menuOperaciones", data).text()) {
                console.log("Pantalla inicial intento " + calls);
                if (calls < MAX_CALLS) {
                    console.log("Volver a intentar");
                    calls++;
                    appointment(index);
                    return;
                }
                console.log("Non máis intentos");
            }

            if ($(".p_cita_a", data).length) {
                $.mobile.hidePageLoadingMsg();

                $.mobile.changePage("#solicitude_cita");

                console.log("Number: " + $(".p_cita_a", data).length);
                console.log("Médico: " + $(".p_cita_a", data).first().text());
                console.log("Centro: " + $(".p_cita_a", data).last().text());

                $("#medico").val($(".p_cita_a", data).first().text());
                $("#centro").val($(".p_cita_a", data).last().text());

                // tipoActoCI: Consulta -> 1, Recetas -> 2
                days = new Array();

                $("#s_fecha", data).children().each(function(index) {
                    if ($(this).attr("value")) {
                        console.log($(this).attr("value"));

                        // A estructura que se parsea ten o seguinte formatio:
                        // diaselecSTR = dias(i)|hMinimasDEM(i)|lDias(i)|lMeses(i)|lAnhos(i)|hMinimasADM(i)|hMaximasADM(i)|hMinimasDEM(i)|hMaximasDEM(i)|i|fTipoDistribucion(i)
                        // * ADM -> receitas
                        // * DEM -> consulta enfermidade
                        // Exemplo: xoves, 19 de xaneiro|09:00|19|1|2012|09:38|13:22|09:00|13:29|10|2
                        days.push($(this).attr("value").split("|"));
                    } else {
                        console.log("Without value at index: " + index);
                    }
                });

                fillDays();
            } else {
                $.mobile.hidePageLoadingMsg();
                alert("Houbo un erro durante a solicitude de cita.\n" +
                        "Revise os datos da tarxeta sanitaria e intenteo de novo mais tarde");
            }

        }
    );

}

function updateDays() {
    resetSelectedDay();
    fillDays();
}

function fillDays() {
    var dia = $("#dia");
    dia.empty();

    dia.change(showDayInfo);

    for (var i = 0; i < days.length; i++) {
        if (checkDayAvailability(i)) {
            dia.append("<option value='" + i + "'>" + days[i][0] +"</option>");
        }
    }
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
    console.log("Rango: " + rango);
    $("#rango").val(rango);

    if (days[i][10] == 1) {
        $("#alerta").val("O/a profesional non podera atenderlle o dia seleccionado.\n" +
                "Remitiraselle a un/unha substituto/a");
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

    console.log("fecha: " + values.fecha);
    console.log("fechaIdonea: " + values.fechaIdonea);
    console.log("fechausa: " + values.fechausa);
    console.log("hora: " + values.hora);
    console.log("indiceDia: " + values.indiceDia);
    console.log("minutos: " + values.minutos);
    console.log("tipoActoCI: " + values.tipoActoCI);
    console.log("tipoDistrib: " + values.tipoDistrib);

    $.mobile.showPageLoadingMsg();

    $.get(BASE_URL + "paso5.asp", values,
        function(data) {
            $.mobile.hidePageLoadingMsg();

            if ($(".p_cita_az", data).length) {
                var message = $(".p_cita_az", data).eq(0).text() + "\n" +
                        $(".p_cita_az", data).eq(2).text() + "\n\n" +
                        "Medico: " + $(".p_cita", data).eq(3).find("strong").text() + "\n" +
                        "Data: " + $(".p_cita", data).eq(5).find("b").text() + "\n" +
                        "Hora: " + $(".p_cita", data).eq(7).find("strong").text();
                alert(message);

                $.mobile.changePage("#inicio");
            } else {
                $.mobile.changePage("#confirmar_cita");

                $("#centro2").val($(".p_cita", data).eq(6).text());
                $("#medico2").val($(".p_cita", data).eq(7).find("strong").text());
                $("#dia2").val($(".p_cita", data).eq(10).find("strong").text());

                hours = new Array();

                var i = 0;

                $("#s_hora", data).children().each(function(index) {
                    console.log("Value: " + $(this).attr("value"));
                    console.log("Selected: " + $(this).attr("selected"));

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

    for (var i = 0; i < hours.length; i++) {
        if (i == selectedHour) {
            hora.append("<option selected='selected' value='" + i + "'>" + hours[i][0] +"</option>");
        } else {
            hora.append("<option value='" + i + "'>" + hours[i][0] +"</option>");
        }
    }
}

function confirmAppointment() {
    var i = $("#hora2").val();

    var values = {
            "codHueco": hours[i][1],
            "horaCita": hours[i][0]
        };

    console.log("codHueco: " + values.codHueco);
    console.log("horaCita: " + values.horaCita);

    $.mobile.showPageLoadingMsg();

    $.get(BASE_URL + "paso6.asp", values,
        function(data) {
            $.mobile.hidePageLoadingMsg();

            if ($(".p_cita_a", data).eq(1).text() == "") {
                alert("Erro confirmando a cita, por favor inténteo de novo")
            } {
                alert($(".p_cita_a", data).eq(1).text());
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
    if (confirm("¿Eliminar tarxeta " + cards[index].alias + "?")) {
        selectedCard = index;

        db.transaction(deleteCardDB, errorCB, successCB);

        loadCards();
        $.mobile.changePage("#inicio");
    }
}

function deleteCardDB(tx) {
    tx.executeSql("DELETE FROM CARD WHERE id='" + cards[selectedCard].id + "';");
}
